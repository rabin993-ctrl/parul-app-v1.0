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

  if (!error && data) {
    return filterUsersByQuery(mapUserRows(data), query);
  }

  // Fallback for environments where the RPC is missing or broken (pre-0087 citext bug).
  const fallbackRows = await searchUsersTable(primary, limit);
  return filterUsersByQuery(mapUserRows(fallbackRows), query);
}
