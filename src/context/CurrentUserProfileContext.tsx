import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import type { User } from '../data/mockData';
import { avatarUrlsFromMedia, fetchAvatarMedia } from '../lib/avatarMedia';
import type { PickedAsset } from '../hooks/useMediaPicker';
import { invalidateUserProfile } from '../hooks/useUserProfile';
import { supabase } from '../lib/supabase';
import { uploadMediaAsset, triggerThumbGeneration } from '../lib/uploads';
import { formatMemberSinceDate } from '../utils/time';
import { geocodeProfileLocation } from '../lib/alertFanOut';
import { persistUserCoordinates } from '../lib/geolocation';
import { useAuth } from './AuthContext';

export type UserProfilePatch = {
  bio?: string;
  location?: string;
  name?: string;
  handle?: string;
};

type CurrentUserProfileContextValue = {
  ready: boolean;
  me: User;
  /** False only for new OAuth users who haven't picked a username yet. */
  onboarded: boolean;
  updateProfile: (patch: UserProfilePatch) => Promise<void>;
  updateAvatar: (asset: PickedAsset) => Promise<void>;
  /** Set the chosen username + name and mark onboarding complete. */
  completeOnboarding: (handle: string, name: string) => Promise<void>;
};

const EMPTY_USER: User = {
  id: '',
  name: '',
  handle: '',
  tint: '#888888',
  loc: '',
  verified: false,
};

// NOTE: must not include location_lat/lng — migration 0080 revoked blanket SELECT
// on users and re-granted only non-PII columns (geo coords were intentionally not
// re-granted). Selecting an un-granted column makes PostgREST return 42501, which
// would break every read/update/onboarding path below.
const USER_SELECT =
  'id,handle,name,tint,bio,location,website,verified,joined_at,avatar_media_id,onboarded';

const CurrentUserProfileContext = createContext<CurrentUserProfileContextValue | null>(null);

type DbUserRow = {
  id: string;
  handle: string;
  name: string;
  tint: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  verified: boolean;
  joined_at: string;
  avatar_media_id: string | null;
  onboarded: boolean;
};

async function rowToUser(row: DbUserRow): Promise<User> {
  const loc = row.location ?? '';
  const base: User = {
    id: row.id,
    name: row.name,
    handle: row.handle,
    tint: row.tint ?? '#888888',
    loc,
    location: loc || undefined,
    verified: row.verified,
    bio: row.bio ?? undefined,
    website: row.website ?? undefined,
    joinedDate: formatMemberSinceDate(row.joined_at),
  };
  if (!row.avatar_media_id) return base;
  const media = await fetchAvatarMedia(row.avatar_media_id);
  return { ...base, ...avatarUrlsFromMedia(media) };
}

export function CurrentUserProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<User>(EMPTY_USER);
  // Default true so existing/returning users are never momentarily prompted; the
  // real value loads below and only new OAuth users resolve to false.
  const [onboarded, setOnboarded] = useState(true);

  useEffect(() => {
    if (!user) {
      setMe(EMPTY_USER);
      setOnboarded(true);
      setReady(false);
      return;
    }
    setReady(false);
    const load = async () => {
      const { data, error } = await supabase
        .from('users')
        .select(USER_SELECT)
        .eq('id', user.id)
        .single();
      if (!error && data) {
        setMe(await rowToUser(data as DbUserRow));
        setOnboarded((data as DbUserRow).onboarded);
        // Coordinates are backfilled at write-time in updateProfile (location is
        // only ever set there). No load-time geocode here — it required reading
        // the un-granted location_lat column and would 42501 the whole load.
      }
      setReady(true);
    };
    load();
  }, [user?.id]);

  const updateProfile = useCallback(async (patch: UserProfilePatch) => {
    if (!user) return;
    const update: Partial<DbUserRow> = {};
    if (patch.bio !== undefined) update.bio = patch.bio;
    if (patch.location !== undefined) update.location = patch.location;
    if (patch.name !== undefined) update.name = patch.name.trim();
    if (patch.handle !== undefined) update.handle = patch.handle.trim().toLowerCase();
    const { data, error } = await supabase
      .from('users')
      .update(update)
      .eq('id', user.id)
      .select(USER_SELECT)
      .single();
    if (error) {
      if (error.code === '23505') throw new Error('That username is already taken');
      throw error;
    }
    if (data) {
      setMe(await rowToUser(data as DbUserRow));
      invalidateUserProfile(user.id);
      if (patch.location !== undefined) {
        const geocoded = await geocodeProfileLocation(patch.location);
        if (geocoded) await persistUserCoordinates(geocoded);
      }
    }
  }, [user]);

  const completeOnboarding = useCallback(async (handle: string, name: string) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('users')
      .update({ handle: handle.trim().toLowerCase(), name: name.trim(), onboarded: true })
      .eq('id', user.id)
      .select(USER_SELECT)
      .single();
    if (error) {
      if (error.code === '23505') throw new Error('That username is already taken');
      throw error;
    }
    if (data) {
      setMe(await rowToUser(data as DbUserRow));
      setOnboarded(true);
      invalidateUserProfile(user.id);
    }
  }, [user]);

  const updateAvatar = useCallback(async (asset: PickedAsset) => {
    if (!user) return;
    const mediaId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const uploaded = await uploadMediaAsset({
      bucket: 'avatars',
      userId: user.id,
      mediaId,
      localUri: asset.uri,
      blob: asset.blob,
      ext: asset.ext,
      mime: asset.mime,
      width: asset.width,
      height: asset.height,
      bytes: asset.bytes,
      generateVariants: false,
    });
    const { data, error } = await supabase
      .from('users')
      .update({ avatar_media_id: mediaId })
      .eq('id', user.id)
      .select(USER_SELECT)
      .single();
    if (error || !data) throw error ?? new Error('Failed to save profile photo');
    const next = await rowToUser(data as DbUserRow);
    setMe({
      ...next,
      avatarUrl: uploaded.originalUrl,
      avatarFallbackUrl: uploaded.originalUrl,
    });
    triggerThumbGeneration();
    invalidateUserProfile(user.id);
  }, [user]);

  const value = useMemo<CurrentUserProfileContextValue>(
    () => ({ ready, me, onboarded, updateProfile, updateAvatar, completeOnboarding }),
    [ready, me, onboarded, updateProfile, updateAvatar, completeOnboarding],
  );

  return (
    <CurrentUserProfileContext.Provider value={value}>
      {children}
    </CurrentUserProfileContext.Provider>
  );
}

export function useCurrentUserProfile() {
  const ctx = useContext(CurrentUserProfileContext);
  if (!ctx) throw new Error('useCurrentUserProfile must be used within CurrentUserProfileProvider');
  return ctx;
}
