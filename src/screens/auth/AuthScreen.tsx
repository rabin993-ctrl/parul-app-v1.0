import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/fonts';
import { radius, spacing, MOBILE_INPUT_FONT_SIZE } from '../../theme/tokens';
import { AppLogo } from '../../components/ui/AppLogo';
import { Button } from '../../components/ui/Button';
import { LegalDocumentView } from '../../components/legal/LegalDocumentView';
import { LEGAL_DOCUMENTS, type LegalDocumentId } from '../../data/legalDocuments';
import { useAuth } from '../../context/AuthContext';
import { isUsernameAvailable } from '../../utils/username';
import { ForgotPasswordSheet } from './ForgotPasswordSheet';
import { CheckEmailScreen } from './CheckEmailScreen';

type UsernameStatus = 'idle' | 'invalid' | 'checking' | 'available' | 'taken';

type Mode = 'signin' | 'signup';

const EMAIL_RE = /\S+@\S+\.\S+/;

export function AuthScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    signIn,
    signInWithGoogle,
    signUp,
    resendConfirmationEmail,
    pendingConfirmationEmail,
    clearPendingConfirmation,
  } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalDocumentId | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');

  const isSignup = mode === 'signup';

  const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

  // Live username availability check (debounced). `username` is already
  // normalized by the field's onChangeText, so we test it directly.
  useEffect(() => {
    if (!isSignup || username.length === 0) { setUsernameStatus('idle'); return; }
    if (!USERNAME_RE.test(username)) { setUsernameStatus('invalid'); return; }
    setUsernameStatus('checking');
    let cancelled = false;
    const t = setTimeout(async () => {
      const ok = await isUsernameAvailable(username);
      if (cancelled) return;
      setUsernameStatus(ok === null ? 'idle' : ok ? 'available' : 'taken');
    }, 450);
    return () => { cancelled = true; clearTimeout(t); };
  }, [username, isSignup]);

  function validate(): string | null {
    if (!EMAIL_RE.test(email.trim())) return 'Enter a valid email address.';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    if (isSignup && name.trim().length < 2) return 'Please enter your name.';
    if (isSignup && !USERNAME_RE.test(username)) return 'Username must be 3–20 characters: letters, numbers, or _.';
    if (isSignup && usernameStatus === 'taken') return 'That username is taken — please choose another.';
    return null;
  }

  async function onSubmit() {
    const v = validate();
    if (v) { setError(v); return; }
    setError(null);
    setInfo(null);
    setLoading(true);
    const res = isSignup
      ? await signUp(email, password, name.trim(), username)
      : await signIn(email, password);
    setLoading(false);
    if (res.error) {
      // Unconfirmed account trying to sign in — route them to the same
      // "check your email" page (it speaks for itself) instead of a raw error.
      if (res.error.toLowerCase().includes('email not confirmed')) {
        setError(null);
        setInfo(null);
        setAwaitingConfirmation(true);
        return;
      }
      setError(res.error);
      return;
    }
    if (isSignup && 'needsEmailConfirmation' in res && res.needsEmailConfirmation) {
      setError(null);
      setInfo(null);
      setAwaitingConfirmation(true);
    }
  }

  function backToForm() {
    setAwaitingConfirmation(false);
    setError(null);
    setInfo(null);
    clearPendingConfirmation();
  }

  async function onGoogle() {
    setError(null);
    setInfo(null);
    setGoogleLoading(true);
    const res = await signInWithGoogle();
    // On web the call redirects the page to Google, so we only get here on a
    // failure to start the flow.
    if (res.error) {
      setError(res.error);
      setGoogleLoading(false);
    }
  }

  async function onResendConfirmation() {
    const target = (pendingConfirmationEmail ?? email).trim().toLowerCase();
    if (!EMAIL_RE.test(target)) {
      setError('Enter a valid email address.');
      return;
    }
    setError(null);
    setInfo(null);
    setResendLoading(true);
    const res = await resendConfirmationEmail(target);
    setResendLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      setInfo(`Confirmation email resent to ${target}.`);
      setAwaitingConfirmation(true);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
    setAwaitingConfirmation(false);
    setLegalDoc(null);
    clearPendingConfirmation();
  }

  if (legalDoc) {
    return (
      <LegalDocumentView
        document={LEGAL_DOCUMENTS[legalDoc]}
        onBack={() => setLegalDoc(null)}
        bottomInset={insets.bottom + spacing.xl2}
      />
    );
  }

  if (awaitingConfirmation) {
    return (
      <CheckEmailScreen
        email={(pendingConfirmationEmail ?? email).trim().toLowerCase()}
        onResend={onResendConfirmation}
        resendLoading={resendLoading}
        info={info}
        error={error}
        onBack={backToForm}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.xl2, paddingBottom: insets.bottom + spacing.xl2 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <AppLogo size={64} showWordmark />
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>
            {isSignup ? 'Create your account to get started.' : 'Welcome back — sign in to continue.'}
          </Text>
        </View>

        <View style={styles.form}>
          {isSignup && (
            <Field
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              autoCapitalize="words"
              autoComplete="name"
              colors={colors}
            />
          )}

          {isSignup && (
            <View>
              <Field
                label="Username"
                value={username}
                onChangeText={t => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="yourusername"
                prefix="@"
                autoCapitalize="none"
                autoComplete="username"
                colors={colors}
              />
              {usernameStatus === 'checking' && (
                <Text style={[styles.usernameHint, { color: colors.textSecondary }]}>Checking availability…</Text>
              )}
              {usernameStatus === 'available' && (
                <Text style={[styles.usernameHint, { color: colors.success }]}>✓ @{username} is available</Text>
              )}
              {usernameStatus === 'taken' && (
                <Text style={[styles.usernameHint, { color: colors.danger }]}>@{username} is taken — try another</Text>
              )}
              {usernameStatus === 'invalid' && (
                <Text style={[styles.usernameHint, { color: colors.textTertiary }]}>3–20 characters: letters, numbers, or _</Text>
              )}
            </View>
          )}

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            colors={colors}
          />

          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder={isSignup ? 'At least 6 characters' : 'Your password'}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete={isSignup ? 'new-password' : 'password'}
            colors={colors}
            accessory={
              <Pressable hitSlop={8} onPress={() => setShowPassword(s => !s)}>
                <Text style={[styles.show, { color: colors.primary }]}>
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </Pressable>
            }
          />

          {!isSignup && (
            <Pressable
              hitSlop={8}
              onPress={() => setForgotOpen(true)}
              style={styles.forgotRow}
            >
              <Text style={[styles.forgotLink, { color: colors.primary }]}>
                Forgot password?
              </Text>
            </Pressable>
          )}

          {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}
          {info && <Text style={[styles.info, { color: colors.textSecondary }]}>{info}</Text>}

          <Button full size="lg" loading={loading} onPress={onSubmit} style={styles.submit}>
            {isSignup ? 'Create account' : 'Sign in'}
          </Button>

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textTertiary }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>
          <Button
            full
            size="lg"
            variant="secondary"
            loading={googleLoading}
            onPress={onGoogle}
          >
            Continue with Google
          </Button>

          {isSignup && (
            <Text style={[styles.legalText, { color: colors.textTertiary }]}>
              By creating an account, you agree to our{' '}
              <Text
                style={[styles.legalLink, { color: colors.primary }]}
                onPress={() => setLegalDoc('terms')}
              >
                Terms of Service
              </Text>
              {' '}and{' '}
              <Text
                style={[styles.legalLink, { color: colors.primary }]}
                onPress={() => setLegalDoc('privacy')}
              >
                Privacy Policy
              </Text>
              .
            </Text>
          )}

          {(awaitingConfirmation || pendingConfirmationEmail) && (
            <View style={styles.resendBlock}>
              <Text style={[styles.resendHint, { color: colors.textSecondary }]}>
                Didn&apos;t get the email? Check spam, then resend.
              </Text>
              <Button
                full
                variant="secondary"
                loading={resendLoading}
                onPress={onResendConfirmation}
              >
                Resend confirmation email
              </Button>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            {isSignup ? 'Already have an account?' : 'New to Parul?'}
          </Text>
          <Pressable hitSlop={8} onPress={() => switchMode(isSignup ? 'signin' : 'signup')}>
            <Text style={[styles.footerLink, { color: colors.primary }]}>
              {isSignup ? 'Sign in' : 'Create an account'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <ForgotPasswordSheet
        visible={forgotOpen}
        initialEmail={email}
        onClose={() => setForgotOpen(false)}
      />
    </KeyboardAvoidingView>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'words' | 'sentences';
  autoComplete?: 'name' | 'email' | 'password' | 'new-password' | 'username';
  colors: ReturnType<typeof useTheme>['colors'];
  accessory?: React.ReactNode;
  prefix?: string;
};

function Field({ label, colors, accessory, prefix, ...input }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        {prefix && (
          <Text style={[styles.prefix, { color: colors.textSecondary }]}>{prefix}</Text>
        )}
        <TextInput
          {...input}
          placeholderTextColor={colors.textTertiary}
          style={[styles.input, { color: colors.text }]}
        />
        {accessory}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl2,
    gap: spacing.xl2,
  },
  header: { alignItems: 'center', gap: spacing.sm },
  tagline: { fontSize: 14.5, fontFamily: fonts.regular, textAlign: 'center' },
  form: { gap: spacing.lg },
  field: { gap: 6 },
  label: { fontSize: 12.5, fontFamily: fonts.semibold, letterSpacing: 0.2 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingRight: spacing.md,
  },
  input: {
    flex: 1,
    fontSize: MOBILE_INPUT_FONT_SIZE,
    fontFamily: fonts.regular,
    paddingVertical: 13,
  },
  prefix: { fontSize: MOBILE_INPUT_FONT_SIZE, fontFamily: fonts.regular, paddingRight: 2 },
  show: { fontSize: 13.5, fontFamily: fonts.semibold },
  forgotRow: { alignSelf: 'flex-end', marginTop: -spacing.sm },
  forgotLink: { fontSize: 13.5, fontFamily: fonts.semibold },
  error: { fontSize: 13.5, fontFamily: fonts.medium, marginTop: -spacing.xs },
  info: { fontSize: 13.5, fontFamily: fonts.regular, lineHeight: 20 },
  resendBlock: { gap: spacing.sm, marginTop: spacing.sm },
  resendHint: { fontSize: 13, fontFamily: fonts.regular, textAlign: 'center', lineHeight: 18 },
  submit: { marginTop: spacing.xs },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.sm },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: 12.5, fontFamily: fonts.regular },
  usernameHint: { fontSize: 12.5, fontFamily: fonts.medium, marginTop: spacing.xs },
  legalText: { fontSize: 12.5, fontFamily: fonts.regular, lineHeight: 18, textAlign: 'center' },
  legalLink: { fontFamily: fonts.semibold },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  footerText: { fontSize: 14, fontFamily: fonts.regular },
  footerLink: { fontSize: 14, fontFamily: fonts.bold },
});
