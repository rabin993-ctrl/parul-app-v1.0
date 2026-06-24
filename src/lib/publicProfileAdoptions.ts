import { supabase } from './supabase';
import { loadListingMediaUrls } from './adoptionMedia';
import type { AdoptionListing, AdoptionStatus, VaccinationStatus } from '../data/adoptionData';
import type { AdoptionRecord, AdoptionUpdate } from '../data/adoptionRecords';

type DbRecordRow = {
  id: string;
  listing_id: string;
  chat_thread_id: string | null;
  poster_user_id: string;
  adopter_user_id: string;
  pet_name: string;
  species: string | null;
  icon: string | null;
  tint: string | null;
  new_home: string | null;
  status: string;
  confirmed_at: string | null;
  completed_milestones: string[];
  poster_endorsed: boolean;
  poster_recommendation: string | null;
  next_update_due_at: string | null;
  closed_reason: string | null;
  closed_at: string | null;
};

type DbUpdateRow = {
  id: string;
  record_id: string;
  type: string;
  author_user_id: string;
  text: string | null;
  endorsement: string | null;
  photo_count: number | null;
  has_video: boolean;
  milestone_id: string | null;
  created_at: string;
};

type DbListingJson = {
  id: string;
  poster_user_id: string;
  name: string;
  species: string;
  breed: string | null;
  age: string | null;
  age_group: string | null;
  gender: string | null;
  location: string | null;
  icon: string | null;
  tint: string | null;
  vaccination: string;
  neutered: boolean;
  microchipped: boolean;
  health_notes: string | null;
  personality: string | null;
  story: string | null;
  requirements: string[];
  urgent: boolean;
  status: string;
  posted_at: string;
  adopted_date: string | null;
  adopted_note: string | null;
  poster: { name: string; handle: string | null; tint: string | null } | null;
};

function rowToUpdate(row: DbUpdateRow): AdoptionUpdate {
  return {
    id: row.id,
    type: row.type as AdoptionUpdate['type'],
    authorId: row.author_user_id,
    text: row.text ?? undefined,
    endorsement: row.endorsement as AdoptionUpdate['endorsement'],
    photoCount: row.photo_count ?? undefined,
    hasVideo: row.has_video,
    milestoneId: row.milestone_id as AdoptionUpdate['milestoneId'],
    createdAt: new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    createdAtMs: new Date(row.created_at).getTime(),
  };
}

export function mapDbRecordRow(row: DbRecordRow, updates: AdoptionUpdate[] = []): AdoptionRecord {
  const confirmedAtMs = row.confirmed_at ? new Date(row.confirmed_at).getTime() : undefined;
  return {
    id: row.id,
    adoptionPostId: row.listing_id,
    chatThreadId: row.chat_thread_id ?? undefined,
    posterId: row.poster_user_id,
    adopterId: row.adopter_user_id,
    petName: row.pet_name,
    species: row.species ?? 'cat',
    icon: row.icon ?? 'cat',
    tint: row.tint ?? '#7A5AE0',
    newHome: row.new_home ?? undefined,
    status: row.status as AdoptionRecord['status'],
    confirmedAt: row.confirmed_at
      ? new Date(row.confirmed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : undefined,
    confirmedAtMs,
    updates,
    completedMilestones: (row.completed_milestones ?? []) as AdoptionRecord['completedMilestones'],
    posterEndorsed: row.poster_endorsed,
    posterRecommendation: row.poster_recommendation as AdoptionRecord['posterRecommendation'],
    nextUpdateDueAt: row.next_update_due_at ?? undefined,
    closedReason: row.closed_reason as 'relisted' | undefined,
    closedAt: row.closed_at
      ? new Date(row.closed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : undefined,
  };
}

function listingJsonToRow(json: DbListingJson, mediaUrls?: string[]): AdoptionListing {
  const tint = json.tint ?? (json.species === 'dog' ? '#E0503F' : '#7A5AE0');
  const urls = mediaUrls?.length ? mediaUrls : undefined;
  return {
    id: json.id,
    pet: null,
    name: json.name,
    species: json.species as AdoptionListing['species'],
    icon: json.icon ?? json.species,
    breed: json.breed ?? '',
    age: json.age ?? '',
    ageGroup: (json.age_group as AdoptionListing['ageGroup']) ?? 'adult',
    gender: (json.gender as 'Male' | 'Female') ?? 'Female',
    loc: json.location ?? '',
    location: json.location ?? '',
    vacc: json.vaccination as VaccinationStatus,
    tint,
    owner: json.poster_user_id,
    userId: json.poster_user_id,
    urgent: json.urgent,
    status: json.status as AdoptionStatus,
    personality: json.personality ?? '',
    story: json.story ?? '',
    requirements: json.requirements ?? [],
    neutered: json.neutered,
    microchipped: json.microchipped,
    healthNotes: json.health_notes ?? '',
    gallery: urls ?? [tint],
    mediaUrls: urls,
    postedAt: new Date(json.posted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    adoptedDate: json.adopted_date
      ? new Date(json.adopted_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : undefined,
    adoptedNote: json.adopted_note ?? undefined,
    posterName: json.poster?.name,
    posterHandle: json.poster?.handle ?? undefined,
    posterTint: json.poster?.tint ?? undefined,
  };
}

export async function fetchPublicProfileAdoptions(profileUserId: string): Promise<AdoptionRecord[]> {
  const { data, error } = await supabase.rpc('get_public_profile_adoptions', {
    p_profile_user_id: profileUserId,
  });
  if (error) {
    if (__DEV__) {
      console.warn('[publicProfileAdoptions] get_public_profile_adoptions failed:', error.message);
    }
    return [];
  }
  return ((data ?? []) as DbRecordRow[]).map(row => mapDbRecordRow(row));
}

export async function fetchPublicAdoptionRecord(recordId: string): Promise<AdoptionRecord | null> {
  const { data, error } = await supabase.rpc('get_public_adoption_record', {
    p_record_id: recordId,
  });
  if (error || !data) {
    if (__DEV__ && error) {
      console.warn('[publicProfileAdoptions] get_public_adoption_record failed:', error.message);
    }
    return null;
  }

  const payload = data as DbRecordRow & { updates?: DbUpdateRow[] };
  const updates = (payload.updates ?? []).map(rowToUpdate);
  return mapDbRecordRow(payload, updates);
}

export async function fetchPublicAdoptionListing(listingId: string): Promise<AdoptionListing | null> {
  const { data, error } = await supabase.rpc('get_public_adoption_listing', {
    p_listing_id: listingId,
  });
  if (error || !data) {
    if (__DEV__ && error) {
      console.warn('[publicProfileAdoptions] get_public_adoption_listing failed:', error.message);
    }
    return null;
  }

  const json = data as DbListingJson;
  const mediaMap = await loadListingMediaUrls([listingId]);
  return listingJsonToRow(json, mediaMap[listingId]);
}
