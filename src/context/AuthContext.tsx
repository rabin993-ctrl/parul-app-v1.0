import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import type { EmailOtpType } from '@supabase/supabase-js';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import {
  clearAuthConfirmUrl,
  getAuthConfirmUrl,
  getSiteUrl,
  hasImplicitAuthCallbackInUrl,
  parseAuthConfirmParams,
} from '../lib/authLinks';
import {
  INVALID_LOGIN_MESSAGE,
  isValidLoginIdentifier,
  resolveLoginEmail,
} from '../utils/loginIdentifier';

type AuthResult = { error: string | null };
type SignUpResult = AuthResult & { needsEmailConfirmation?: boolean };

export type AuthConfirmPhase = 'none' | 'verifying' | 'recovery' | 'error' | 'success';

interface AuthContextValue {
  initializing: boolean;
  session: Session | null;
  user: User | null;
  authConfirmPhase: AuthConfirmPhase;
  authConfirmError: string | null;
  pendingConfirmationEmail: string | null;
  pendingRecoveryEmail: string | null;
  authLinkKind: 'recovery' | 'signup' | 'invite' | null;
  /** `identifier` may be an email address or username (handle). */
  signIn: (identifier: string, password: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signUp: (email: string, password: string, name?: string, handle?: string) => Promise<SignUpResult>;
  resendConfirmationEmail: (email: string) => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  clearAuthConfirm: () => void;
  clearPendingConfirmation: () => void;
  clearPendingRecovery: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  initializing: true,
  session: null,
  user: null,
  authConfirmPhase: 'none',
  authConfirmError: null,
  pendingConfirmationEmail: null,
  pendingRecoveryEmail: null,
  authLinkKind: null,
  signIn: async () => ({ error: null }),
  signInWithGoogle: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  resendConfirmationEmail: async () => ({ error: null }),
  resetPassword: async () => ({ error: null }),
  updatePassword: async () => ({ error: null }),
  clearAuthConfirm: () => {},
  clearPendingConfirmation: () => {},
  clearPendingRecovery: () => {},
  signOut: async () => {},
});

async function verifyEmailLink(tokenHash: string, type: EmailOtpType) {
  const typesToTry: EmailOtpType[] =
    type === 'email' || type === 'signup'
      ? ['email', 'signup']
      : [type];

  let lastError: { message: string } | null = null;
  for (const otpType of typesToTry) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType });
    if (!error) return { error: null };
    lastError = error;
  }
  return { error: lastError };
}

/** Read `type` from hash or query before the URL is cleared. */
function readCallbackTypeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  return url.searchParams.get('type')
    ?? new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash).get('type');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [authConfirmPhase, setAuthConfirmPhase] = useState<AuthConfirmPhase>('none');
  const [authConfirmError, setAuthConfirmError] = useState<string | null>(null);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null);
  const [pendingRecoveryEmail, setPendingRecoveryEmail] = useState<string | null>(null);
  const [authLinkKind, setAuthLinkKind] = useState<'recovery' | 'signup' | 'invite' | null>(null);

  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      // PKCE recovery links may omit type=recovery in the URL; this event is the
      // reliable signal to show SetNewPasswordScreen on web.
      if (event === 'PASSWORD_RECOVERY') {
        setAuthConfirmPhase('recovery');
        setAuthConfirmError(null);
        setAuthLinkKind('recovery');
        setInitializing(false);
      }
    });

    (async () => {
      // Finish parsing hash/code redirects from Supabase {{ .ConfirmationURL }} before we branch.
      await supabase.auth.initialize();

      const confirmParams = parseAuthConfirmParams();
      if (confirmParams) {
        setAuthConfirmPhase('verifying');
        const { error } = await verifyEmailLink(confirmParams.tokenHash, confirmParams.type);
        clearAuthConfirmUrl();

        if (!mounted) return;

        if (error) {
          setAuthConfirmPhase('error');
          setAuthConfirmError(error.message);
          if (confirmParams.type === 'recovery') setAuthLinkKind('recovery');
          else if (confirmParams.type === 'invite') setAuthLinkKind('invite');
          else setAuthLinkKind('signup');
        } else if (confirmParams.type === 'recovery' || confirmParams.type === 'invite') {
          setAuthConfirmPhase('recovery');
          setAuthLinkKind(confirmParams.type === 'invite' ? 'invite' : 'recovery');
          setAuthConfirmError(null);
        } else {
          // Email/signup confirmation succeeded. verifyOtp establishes a session,
          // but per product decision we do NOT auto-login (the link is often
          // opened on a different device than signup). Sign out and show a success
          // screen prompting an explicit sign-in. Guard signOut so a rejection
          // can't escape this IIFE and leave the app stuck on the spinner.
          try {
            await supabase.auth.signOut();
          } catch {
            // ignore — the success screen short-circuits rendering regardless
          }
          if (!mounted) return;
          setSession(null);
          setPendingConfirmationEmail(null);
          setAuthConfirmPhase('success');
          setInitializing(false);
          return;
        }

        try {
          const { data } = await supabase.auth.getSession();
          if (mounted) setSession(data.session);
        } finally {
          // Always clear the loading flag — otherwise a rejected getSession()
          // leaves the app stuck on the spinner forever.
          if (mounted) setInitializing(false);
        }
        return;
      }

      const implicitCallback = hasImplicitAuthCallbackInUrl();
      const callbackType = implicitCallback ? readCallbackTypeFromUrl() : null;
      if (implicitCallback) {
        setAuthConfirmPhase('verifying');
      }

      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (implicitCallback) {
          clearAuthConfirmUrl();
          if (error || !data.session) {
            setAuthConfirmPhase('error');
            setAuthConfirmError(error?.message ?? 'This link may have expired or already been used.');
            if (callbackType === 'recovery') setAuthLinkKind('recovery');
            else if (callbackType === 'invite') setAuthLinkKind('invite');
          } else if (callbackType === 'recovery' || callbackType === 'invite') {
            setAuthConfirmPhase('recovery');
            setAuthLinkKind(callbackType === 'invite' ? 'invite' : 'recovery');
            setAuthConfirmError(null);
          } else {
            setAuthConfirmPhase(prev => (prev === 'recovery' ? 'recovery' : 'none'));
            setPendingConfirmationEmail(null);
          }
        }

        setSession(data.session);
      } catch {
        if (implicitCallback && mounted) {
          clearAuthConfirmUrl();
          setAuthConfirmPhase('error');
          setAuthConfirmError('Could not complete sign-in from this link.');
        }
      } finally {
        if (mounted) setInitializing(false);
      }
    })();

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (identifier: string, password: string): Promise<AuthResult> => {
    if (!isValidLoginIdentifier(identifier)) {
      return { error: INVALID_LOGIN_MESSAGE };
    }
    const normalized = await resolveLoginEmail(identifier);
    if (!normalized) {
      return { error: INVALID_LOGIN_MESSAGE };
    }
    const { error } = await supabase.auth.signInWithPassword({ email: normalized, password });
    if (error?.message.toLowerCase().includes('email not confirmed')) {
      setPendingConfirmationEmail(normalized);
    } else if (!error) {
      setPendingConfirmationEmail(null);
    }
    if (error && /invalid login credentials/i.test(error.message)) {
      return { error: INVALID_LOGIN_MESSAGE };
    }
    return { error: error?.message ?? null };
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    if (Platform.OS === 'web') {
      // Web redirect flow: Supabase sends the user to Google, then back to our
      // origin with a ?code= that supabase-js exchanges automatically
      // (detectSessionInUrl is enabled for web in src/lib/supabase.ts).
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getSiteUrl(),
          queryParams: { prompt: 'select_account' },
        },
      });
      return { error: error?.message ?? null };
    }

    // Native flow: open the system auth browser, let Supabase bounce through
    // Google and back to our app scheme, then exchange the PKCE code.
    // `parul://` is the app scheme (app.json) and is allow-listed on Supabase
    // (additional_redirect_urls includes "parul://**").
    const redirectTo = 'parul://auth-callback';
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) return { error: error.message };
    if (!data?.url) return { error: 'Could not start Google sign-in.' };

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success' || !result.url) {
      // User dismissed/cancelled the browser — not an error worth surfacing.
      return { error: null };
    }

    const url = new URL(result.url);
    const code = url.searchParams.get('code');
    if (!code) {
      return { error: url.searchParams.get('error_description') ?? 'Google sign-in was not completed.' };
    }
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    return { error: exchangeError?.message ?? null };
  }, []);

  const signUp = useCallback(async (
    email: string,
    password: string,
    name?: string,
    handle?: string,
  ): Promise<SignUpResult> => {
    const normalized = email.trim().toLowerCase();
    const meta: Record<string, string> = {};
    if (name) { meta.name = name; meta.display_name = name; }
    if (handle) meta.handle = handle;

    const { data, error } = await supabase.auth.signUp({
      email: normalized,
      password,
      options: {
        emailRedirectTo: getAuthConfirmUrl(),
        ...(Object.keys(meta).length ? { data: meta } : {}),
      },
    });

    if (error) {
      // Some Supabase versions return an explicit error for an existing account.
      if (/already.*(registered|exists)|exists/i.test(error.message)) {
        return { error: 'An account with this email already exists. Try signing in instead.' };
      }
      return { error: error.message };
    }

    // With email confirmations on, signing up an email that already belongs to a
    // confirmed account returns a fake user with an empty identities array and no
    // error (enumeration protection). Detect it and surface a clear message
    // instead of a phantom "check your email" prompt that never arrives.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { error: 'An account with this email already exists. Try signing in instead.' };
    }

    const needsEmailConfirmation = !!data.user && !data.session;
    if (needsEmailConfirmation) {
      setPendingConfirmationEmail(normalized);
    } else {
      setPendingConfirmationEmail(null);
    }

    return { error: null, needsEmailConfirmation };
  }, []);

  const resendConfirmationEmail = useCallback(async (email: string): Promise<AuthResult> => {
    const normalized = email.trim().toLowerCase();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: normalized,
      options: { emailRedirectTo: getAuthConfirmUrl() },
    });
    if (!error) setPendingConfirmationEmail(normalized);
    return { error: error?.message ?? null };
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<AuthResult> => {
    const normalized = email.trim().toLowerCase();
    const { error } = await supabase.auth.resetPasswordForEmail(
      normalized,
      { redirectTo: getAuthConfirmUrl() },
    );
    if (!error) {
      setPendingRecoveryEmail(normalized);
      setAuthLinkKind('recovery');
    }
    return { error: error?.message ?? null };
  }, []);

  const updatePassword = useCallback(async (password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) {
      setAuthConfirmError(null);
      setPendingRecoveryEmail(null);
      setAuthLinkKind(null);
    }
    return { error: error?.message ?? null };
  }, []);

  const clearAuthConfirm = useCallback(() => {
    setAuthConfirmPhase('none');
    setAuthConfirmError(null);
    setAuthLinkKind(null);
  }, []);

  const clearPendingConfirmation = useCallback(() => {
    setPendingConfirmationEmail(null);
  }, []);

  const clearPendingRecovery = useCallback(() => {
    setPendingRecoveryEmail(null);
    setAuthLinkKind(null);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setAuthConfirmPhase('none');
    setAuthConfirmError(null);
    setPendingConfirmationEmail(null);
    setPendingRecoveryEmail(null);
    setAuthLinkKind(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        initializing,
        session,
        user: session?.user ?? null,
        authConfirmPhase,
        authConfirmError,
        pendingConfirmationEmail,
        pendingRecoveryEmail,
        authLinkKind,
        signIn,
        signInWithGoogle,
        signUp,
        resendConfirmationEmail,
        resetPassword,
        updatePassword,
        clearAuthConfirm,
        clearPendingConfirmation,
        clearPendingRecovery,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
