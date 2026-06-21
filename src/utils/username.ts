import { supabase } from '../lib/supabase';

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

export function validateUsername(username: string): string | null {
  if (!USERNAME_RE.test(username)) {
    return 'Username must be 3–20 characters: letters, numbers, or _.';
  }
  return null;
}

/**
 * Checks whether a username (handle) is free, via the is_handle_available RPC
 * (SECURITY DEFINER, callable by anon during sign-up). Returns:
 *   true → available, false → taken, null → couldn't determine (invalid/offline).
 */
export async function isUsernameAvailable(username: string): Promise<boolean | null> {
  const normalized = normalizeUsername(username);
  if (!USERNAME_RE.test(normalized)) return null;
  const { data, error } = await supabase.rpc(
    'is_handle_available' as never,
    { p_handle: normalized } as never,
  );
  if (error) return null;
  return data === true;
}
