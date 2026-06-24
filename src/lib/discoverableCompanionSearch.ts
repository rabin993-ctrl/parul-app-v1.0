import { supabase } from './supabase';
import { filterCompanionsByQuery, type SearchCompanionResult } from '../utils/feedSearch';
import { escapeIlikePattern, parseSearchTokens } from '../utils/textSearch';

type CompanionRow = {
  id: string;
  owner_id: string;
  name: string | null;
  handle: string | null;
  species: string | null;
  breed: string | null;
  icon: string | null;
  tint: string | null;
};

function mapCompanionRows(rows: CompanionRow[]): SearchCompanionResult[] {
  return rows.map(row => ({
    id: row.id,
    name: row.name ?? row.handle ?? row.id.slice(0, 8),
    handle: row.handle ?? undefined,
    species: row.species ?? undefined,
    breed: row.breed ?? undefined,
    icon: row.icon ?? undefined,
    tint: row.tint ?? undefined,
    ownerId: row.owner_id,
  }));
}

async function searchCompanionsTable(queryToken: string, limit: number): Promise<CompanionRow[]> {
  const pattern = `%${escapeIlikePattern(queryToken)}%`;
  const { data } = await supabase
    .from('companions')
    .select('id, owner_id, name, handle, species, breed, icon, tint')
    .is('deleted_at', null)
    .or(`name.ilike.${pattern},handle.ilike.${pattern},breed.ilike.${pattern},species.ilike.${pattern}`)
    .limit(limit);
  return data ?? [];
}

/** Search companions by pet name, #handle, breed, or species (Feed search, etc.). */
export async function searchDiscoverableCompanions(
  query: string,
  limit = 40,
): Promise<SearchCompanionResult[]> {
  const tokens = parseSearchTokens(query);
  if (tokens.length === 0) return [];

  const byId = new Map<string, SearchCompanionResult>();
  for (const token of tokens.slice(0, 3)) {
    const rows = await searchCompanionsTable(token, limit);
    for (const row of filterCompanionsByQuery(mapCompanionRows(rows), query)) {
      byId.set(row.id, row);
    }
  }

  return [...byId.values()];
}
