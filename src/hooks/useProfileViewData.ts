import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  type ProfileTrust,
  type ProfileImpactStats,
  type RescueCase,
  RESCUE_STATUS_META,
  formatRescueUpdateTime,
} from '../data/profileData';
import {
  filterIncomingAdopted,
  filterOutgoingAdoptions,
} from '../data/adoptionRecords';
import { useAdoption } from '../context/AdoptionContext';
import { useFeedPosts } from '../context/FeedPostContext';
import { useCompanions } from '../context/CompanionContext';
import { useAuth } from '../context/AuthContext';
import type { Companion } from '../data/mockData';
import { isUserProfileFeedPost } from '../utils/postCompanion';
import { fetchUserPrivacyFlags, getCachedUserPrivacyFlags } from '../lib/userPrivacyFlagCache';
import { fetchPublicProfileAdoptions } from '../lib/publicProfileAdoptions';
import type { AdoptionRecord } from '../data/adoptionRecords';

const DEFAULT_TRUST: ProfileTrust = { rating: 0, reviewCount: 0, flagCount: 0, status: 'good' };
const DEFAULT_STATS: ProfileImpactStats = { rescues: 0, rehomed: 0, adopted: 0, following: 0 };

type DbTrustRow = {
  rating: string | number;
  review_count: string | number;
  flag_count: string | number;
  status: ProfileTrust['status'];
};

type DbRescaseCaseRow = {
  id: string;
  poster_user_id: string;
  case_code: string | null;
  name: string;
  species: string;
  icon: string | null;
  tint: string | null;
  status: string;
  location: string | null;
  story: string | null;
  tags: string[];
  created_at: string;
  cover: { url: string; thumb_url: string | null } | null;
};

const SPECIES_META = {
  dog: { tint: '#14A697', icon: 'dog' },
  cat: { tint: '#7A5AE0', icon: 'cat' },
  other: { tint: '#C98E2A', icon: 'paw' },
} as const;

function mapDbRescue(row: DbRescaseCaseRow): RescueCase {
  const speciesKey = (row.species as keyof typeof SPECIES_META) in SPECIES_META
    ? (row.species as keyof typeof SPECIES_META)
    : 'other';
  return {
    id: row.id,
    userId: row.poster_user_id,
    name: row.name,
    species: row.species,
    icon: row.icon ?? SPECIES_META[speciesKey].icon,
    tint: row.tint ?? SPECIES_META[speciesKey].tint,
    status: (row.status ?? 'active') as RescueCase['status'],
    date: formatRescueUpdateTime(new Date(row.created_at)),
    location: row.location ?? '',
    story: row.story ?? '',
    caseId: row.case_code ?? undefined,
    tags: row.tags ?? [],
    followers: 0,
    coverUrl: row.cover?.url ?? undefined,
    updates: [],
  };
}

/** Shared profile feed data for own profile (ProfileHome) and public profile (UserProfile). */
export function useProfileViewData(userId: string) {
  const { user: authUser } = useAuth();
  const { records } = useAdoption();
  const { posts: feedPosts } = useFeedPosts();
  const { getMyCompanions, fetchCompanionsForOwner } = useCompanions();
  const isSelf = authUser?.id === userId;

  // Async data from Supabase
  const [trust, setTrust] = useState<ProfileTrust>(DEFAULT_TRUST);
  const [impactStats, setImpactStats] = useState<ProfileImpactStats>(DEFAULT_STATS);
  const [rescues, setRescues] = useState<RescueCase[]>([]);
  const [userCompanions, setUserCompanions] = useState<Companion[]>([]);
  const [skipCompanions, setSkipCompanions] = useState(false);
  const [visitorPlacementRecords, setVisitorPlacementRecords] = useState<AdoptionRecord[]>([]);

  useEffect(() => {
    if (!userId || authUser?.id === userId) {
      setSkipCompanions(false);
      return;
    }
    let cancelled = false;
    void fetchUserPrivacyFlags([userId]).then(() => {
      if (cancelled) return;
      const flags = getCachedUserPrivacyFlags(userId);
      setSkipCompanions(flags?.showCompanions === false);
    });
    return () => { cancelled = true; };
  }, [userId, authUser?.id]);

  useEffect(() => {
    if (!userId || isSelf) {
      setVisitorPlacementRecords([]);
      return;
    }
    let cancelled = false;
    void fetchPublicProfileAdoptions(userId).then(fetched => {
      if (!cancelled) setVisitorPlacementRecords(fetched);
    });
    return () => { cancelled = true; };
  }, [userId, isSelf]);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      const [trustRes, rescueRes, rehomRes, adoptedRes, rescueCasesRes, companionFollowRes] = await Promise.all([
        supabase
          .from('profile_trust')
          .select('rating,review_count,flag_count,status')
          .eq('user_id', userId)
          .single(),
        supabase
          .from('rescue_cases')
          .select('id', { count: 'exact', head: true })
          .eq('poster_user_id', userId)
          .is('deleted_at', null),
        isSelf
          ? supabase
              .from('adoption_listings')
              .select('id', { count: 'exact', head: true })
              .eq('poster_user_id', userId)
              .eq('status', 'Adopted')
              .is('deleted_at', null)
          : Promise.resolve({ count: 0, data: null, error: null }),
        isSelf
          ? supabase
              .from('adoption_records')
              .select('id', { count: 'exact', head: true })
              .eq('adopter_user_id', userId)
          : Promise.resolve({ count: 0, data: null, error: null }),
        supabase
          .from('rescue_cases')
          .select('id,poster_user_id,case_code,name,species,icon,tint,status,location,story,tags,created_at,cover_media_id,cover:media_assets!cover_media_id(url,thumb_url)')
          .eq('poster_user_id', userId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('companion_followers')
          .select('companion_id')
          .eq('user_id', userId),
      ]);

      const companionFollowIds = (companionFollowRes.data ?? []).map(r => r.companion_id);

      const activeCompanionFollowsRes = companionFollowIds.length > 0
        ? await supabase
            .from('companions')
            .select('id')
            .in('id', companionFollowIds)
            .is('deleted_at', null)
        : { data: [] as { id: string }[], error: null };

      if (!trustRes.error && trustRes.data) {
        const t = trustRes.data as DbTrustRow;
        setTrust({
          rating: Number(t.rating),
          reviewCount: Number(t.review_count),
          flagCount: Number(t.flag_count),
          status: t.status,
        });
      }

      setImpactStats(prev => ({
        rescues: rescueRes.count ?? 0,
        rehomed: isSelf ? (rehomRes.count ?? 0) : prev.rehomed,
        adopted: isSelf ? (adoptedRes.count ?? 0) : prev.adopted,
        following: activeCompanionFollowsRes.data?.length ?? 0,
      }));

      if (!rescueCasesRes.error && rescueCasesRes.data) {
        setRescues((rescueCasesRes.data as DbRescaseCaseRow[]).map(mapDbRescue));
      }
    };
    load();
  }, [userId, isSelf]);

  useEffect(() => {
    if (!userId || isSelf) return;
    setImpactStats(prev => ({
      ...prev,
      rehomed: filterOutgoingAdoptions(visitorPlacementRecords, userId).length,
      adopted: filterIncomingAdopted(visitorPlacementRecords, userId).length,
    }));
  }, [userId, isSelf, visitorPlacementRecords]);

  useEffect(() => {
    if (!userId || skipCompanions) {
      if (skipCompanions) setUserCompanions([]);
      return;
    }
    const cached = getMyCompanions(userId);
    if (cached.length > 0) setUserCompanions(cached);

    let cancelled = false;
    fetchCompanionsForOwner(userId).then(companions => {
      if (!cancelled) setUserCompanions(companions);
    });
    return () => { cancelled = true; };
  }, [userId, skipCompanions, getMyCompanions, fetchCompanionsForOwner]);

  // Posts/Rescues/Adoptions: still from mock sources until Wave 2–4 wire them
  const posts = useMemo(
    () => feedPosts.filter(p => isUserProfileFeedPost(p, userId)),
    [feedPosts, userId],
  );

  const placementRecords = isSelf ? records : visitorPlacementRecords;

  const outgoingAdoptions = useMemo(
    () => filterOutgoingAdoptions(placementRecords, userId),
    [placementRecords, userId],
  );
  const incomingAdopted = useMemo(
    () => filterIncomingAdopted(placementRecords, userId),
    [placementRecords, userId],
  );

  return {
    posts,
    rescues,
    outgoingAdoptions,
    incomingAdopted,
    impactStats,
    trust,
    userCompanions,
  };
}
