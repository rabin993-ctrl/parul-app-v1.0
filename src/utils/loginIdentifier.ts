import { supabase } from '../lib/supabase';
import { normalizeUsername, USERNAME_RE } from './username';

const EMAIL_RE = /\S+@\S+\.\S+/;

export const INVALID_LOGIN_MESSAGE = 'Invalid email/username or password.';

/** Normalize sign-in field input (email stays as-is apart from case; usernames lowercased). */
export function normalizeLoginIdentifierInput(raw: string): string {
  const trimmed = raw.trimStart();
  if (trimmed.includes('@')) {
    return trimmed.toLowerCase();
  }
  return normalizeUsername(trimmed.replace(/^@/, ''));
}

export function isValidLoginIdentifier(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (EMAIL_RE.test(trimmed)) return true;
  return USERNAME_RE.test(normalizeUsername(trimmed.replace(/^@/, '')));
}

/** Map email or username to the Supabase Auth email address. */
export async function resolveLoginEmail(identifier: string): Promise<string | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  if (trimmed.includes('@')) {
    return trimmed.toLowerCase();
  }

  const { data, error } = await supabase.rpc(
    'resolve_login_email' as never,
    { p_identifier: trimmed } as never,
  );
  if (error || typeof data !== 'string' || !data) return null;
  return data;
}
