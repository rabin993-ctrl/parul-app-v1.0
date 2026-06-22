/** True when a string looks like an auto-generated id fragment, not a chosen display name. */
export function looksLikeAutoHandle(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  if (/^[0-9a-f]{8}$/i.test(v)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return true;
  return false;
}

/** Prefer a human display name; fall back to handle, then a short id fragment. */
export function resolveUserDisplayName(opts: {
  name?: string | null;
  handle?: string | null;
  userId?: string;
}): string {
  const name = opts.name?.trim() ?? '';
  const handle = opts.handle?.trim().replace(/^@/, '') ?? '';

  if (name && !looksLikeAutoHandle(name) && name.toLowerCase() !== handle.toLowerCase()) {
    return name;
  }
  if (name && !looksLikeAutoHandle(name)) return name;
  if (handle && !looksLikeAutoHandle(handle)) return handle;
  if (name) return name;
  if (handle) return handle;
  return opts.userId?.slice(0, 8) ?? 'User';
}
