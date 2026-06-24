/** Shown in UI and search, e.g. "#milo" (distinct from user @handles). */
export const COMPANION_HANDLE_DISPLAY_PREFIX = '#';

/** Search / canonical token prefix, e.g. "#milo". */
export const COMPANION_HANDLE_SEARCH_PREFIX = COMPANION_HANDLE_DISPLAY_PREFIX;

/** @deprecated Use COMPANION_HANDLE_DISPLAY_PREFIX */
export const COMPANION_HANDLE_PREFIX = COMPANION_HANDLE_DISPLAY_PREFIX;

/** Normalize stored handle slug (strips leading #, lowercase, hyphens). */
export function normalizeCompanionHandle(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Default handle derived from a companion display name. */
export function companionHandleFromName(name: string): string {
  return normalizeCompanionHandle(name.trim());
}

export function validateCompanionHandle(handle: string): string | null {
  const normalized = normalizeCompanionHandle(handle);
  if (!normalized) return 'Companion username is required.';
  if (normalized.length < 2) return 'Companion username must be at least 2 characters.';
  return null;
}

export function sanitizeCompanionHandleInput(text: string): string {
  return text
    .replace(/^#+/, '')
    .replace(/[^a-z0-9-]/gi, '')
    .toLowerCase();
}

export function companionHandleSlug(
  handle: string | null | undefined,
  fallbackId?: string,
): string {
  return normalizeCompanionHandle(handle ?? '') || (fallbackId?.slice(0, 8) ?? '');
}

/** Search token, e.g. "#milo". */
export function formatCompanionHandleSearchToken(
  handle: string | null | undefined,
  fallbackId?: string,
): string {
  const slug = companionHandleSlug(handle, fallbackId);
  return slug ? `${COMPANION_HANDLE_SEARCH_PREFIX}${slug}` : '';
}

/** User-facing label, e.g. "#milo". Falls back to a slug from the pet name, never a raw id. */
export function formatCompanionHandleLabel(
  handle: string | null | undefined,
  fallbackName?: string,
): string {
  const slug = normalizeCompanionHandle(handle ?? '')
    || (fallbackName ? companionHandleFromName(fallbackName) : '');
  return slug ? `${COMPANION_HANDLE_DISPLAY_PREFIX}${slug}` : '';
}

/** Extract #handle tokens from a search query (without the # prefix). */
export function parseCompanionHandleSearchTokens(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(token => token.startsWith(COMPANION_HANDLE_SEARCH_PREFIX))
    .map(token => normalizeCompanionHandle(token.slice(COMPANION_HANDLE_SEARCH_PREFIX.length)))
    .filter(Boolean);
}
