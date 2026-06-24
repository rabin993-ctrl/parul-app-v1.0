import { useCallback, useMemo, useState } from 'react';
import type { ForwardDest, ForwardQuickAction } from '../components/ForwardSheet';
import type { Companion } from '../data/mockData';
import type { ToastData } from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { usePawCircles } from '../context/PawCircleContext';
import { useCommunityGroups } from '../context/CommunityGroupsContext';
import { useTheme } from '../theme/ThemeContext';
import { shareCompanionProfile } from '../utils/shareCompanionProfile';
import { shareCompanionProfileLink } from '../utils/shareLinks';

export function useCompanionProfileShare(onToast: (t: ToastData) => void) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { createdCircles, joinedCircles } = usePawCircles();
  const { joinedCommunities } = useCommunityGroups();
  const [shareCompanion, setShareCompanion] = useState<Companion | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const openShare = useCallback((companion: Companion) => {
    setShareCompanion(companion);
    setShareOpen(true);
  }, []);

  const closeShare = useCallback(() => {
    setShareOpen(false);
  }, []);

  const copyShareLink = useCallback(async () => {
    if (!shareCompanion) return;
    const ok = await shareCompanionProfileLink(shareCompanion.id);
    setShareOpen(false);
    if (ok) {
      onToast({ msg: 'Profile link copied', icon: 'check', tone: 'success' });
    } else {
      onToast({ msg: 'Could not copy profile link', icon: 'close', tone: 'danger' });
    }
  }, [onToast, shareCompanion]);

  const quickActions = useMemo<ForwardQuickAction[]>(() => ([
    {
      id: 'copy-link',
      label: 'Copy link',
      subtitle: 'Copy profile URL to clipboard',
      icon: 'clipboard-list',
      iconTint: colors.primary,
      iconBg: colors.primary + '18',
      onPress: () => { void copyShareLink(); },
    },
  ]), [colors.primary, copyShareLink]);

  const completeShare = useCallback(async (dests: ForwardDest[], note?: string) => {
    if (!shareCompanion || !user || dests.length === 0) return;
    await shareCompanionProfile(shareCompanion, dests, user.id, note);
    setShareOpen(false);
    const label = dests.map(d => d.label).join(', ');
    onToast({ msg: `Shared to ${label}`, icon: 'forward', tone: 'success' });
  }, [onToast, shareCompanion, user]);

  return {
    shareOpen,
    shareCompanion,
    openShare,
    closeShare,
    completeShare,
    quickActions,
    createdCircles,
    joinedCircles,
    joinedCommunities,
  };
}
