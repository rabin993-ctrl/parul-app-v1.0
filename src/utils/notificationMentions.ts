import { supabase } from '../lib/supabase';

const MEMBER_HANDLE_RE = /@([a-zA-Z0-9._-]+)/g;

/** Extract @handle tokens (member mentions only — excludes spaced circle/community names). */
export function extractMemberHandles(
  text: string,
  confirmedTokens: string[] = [],
): string[] {
  const handles = new Set<string>();
  for (const token of confirmedTokens) {
    const raw = token.startsWith('@') ? token.slice(1) : token;
    if (raw && !/\s/.test(raw)) handles.add(raw);
  }
  for (const match of text.matchAll(MEMBER_HANDLE_RE)) {
    handles.add(match[1]);
  }
  return [...handles];
}

export async function resolveHandlesToUserIds(handles: string[]): Promise<string[]> {
  const unique = [...new Set(handles.map(h => h.trim()).filter(Boolean))];
  if (unique.length === 0) return [];

  const { data } = await supabase
    .from('users')
    .select('id, handle')
    .in('handle', unique);

  const ids: string[] = [];
  for (const row of data ?? []) {
    const id = (row as { id: string; handle: string | null }).id;
    if (id) ids.push(id);
  }
  return ids;
}

export async function resolveMentionRecipientIds(
  text: string,
  opts?: {
    confirmedTokens?: string[];
    excludeUserIds?: string[];
  },
): Promise<string[]> {
  const handles = extractMemberHandles(text, opts?.confirmedTokens);
  const exclude = new Set(opts?.excludeUserIds?.filter(Boolean));
  const ids = await resolveHandlesToUserIds(handles);
  return [...new Set(ids.filter(id => !exclude.has(id)))];
}
