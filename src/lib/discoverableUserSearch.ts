import { supabase } from './supabase';
import { filterUsersByQuery, type SearchUserResult } from '../utils/feedSearch';
import { escapeIlikePattern, parseSearchTokens } from '../utils/textSearch';

type UserRow = {
  id: string;
  name: string | null;
  handle: string | null;
  tint: string | null;
};

function mapUserRows(rows: UserRow[]): SearchUserResult[] {
  return rows.map(row => ({
    id: row.id,
    name: row.name ?? row.handle ?? row.id.slice(0, 8),
    handle: row.handle ?? undefined,
    tint: row.tint ?? undefined,
  }));
}

async function searchUsersTable(queryToken: string, limit: number): Promise<UserRow[]> {
  const { data } = await supabase
    .from('users')
    .select('id, name, handle, tint')
    .or(`name.ilike.%${queryToken}%,handle.ilike.%${queryToken}%`)
    .limit(limit);
  return data ?? [];
}

/** Search discoverable users by name or @username (Feed search, etc.). */
export async function searchDiscoverableUsers(
  query: string,
  limit = 40,
): Promise<SearchUserResult[]> {
  const tokens = parseSearchTokens(query);
  if (tokens.length === 0) return [];

  const primary = escapeIlikePattern(tokens[0]);
  const { data, error } = await supabase.rpc('search_discoverable_users', {
    p_query: primary,
    p_limit: limit,
  });

  const byId = new Map<string, SearchUserResult>();

  if (!error && data) {
    for (const row of filterUsersByQuery(mapUserRows(data), query)) {
      byId.set(row.id, row);
    }
  }

  // Query each token so multi-word names and partial @handles match reliably.
  for (const token of tokens.slice(0, 3)) {
    const fallbackRows = await searchUsersTable(escapeIlikePattern(token), limit);
    for (const row of filterUsersByQuery(mapUserRows(fallbackRows), query)) {
      byId.set(row.id, row);
    }
  }

  return [...byId.values()];
}
