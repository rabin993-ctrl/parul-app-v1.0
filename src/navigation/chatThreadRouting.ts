import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ChatThread } from '../context/AdoptionContext';
import type { CirclesStackParamList } from './CirclesNavigator';
import { navigateToPublicUserProfile } from './userProfileRouting';
import type { UserProfileReturnTo } from './userProfileBack';

export type ChatThreadRouteParams = {
  threadId: string;
  participantId?: string;
  participantName?: string;
  participantHandle?: string;
  participantTint?: string;
  participantAvatarUrl?: string;
  participantAvatarFallbackUrl?: string;
  participantAvatarOriginalUrl?: string;
  adoptionPostId?: string;
  adoptionRecordId?: string;
  threadConnecting?: boolean;
  rescueCaseOriginId?: string;
};

type CirclesNav = NativeStackNavigationProp<CirclesStackParamList>;

export function chatThreadToRouteParams(thread: ChatThread): ChatThreadRouteParams {
  return {
    threadId: thread.id,
    participantId: thread.participantId,
    participantName: thread.participantName,
    participantHandle: thread.participantHandle,
    participantTint: thread.participantTint,
    participantAvatarUrl: thread.participantAvatarUrl,
    participantAvatarFallbackUrl: thread.participantAvatarFallbackUrl,
    participantAvatarOriginalUrl: thread.participantAvatarOriginalUrl,
    adoptionPostId: thread.adoptionPostId,
    adoptionRecordId: thread.adoptionRecordId,
    threadConnecting: false,
    rescueCaseOriginId: thread.rescueContext?.caseId,
  };
}

export function navigateToChatThread(
  navigation: CirclesNav,
  thread: ChatThread,
  extra?: Partial<ChatThreadRouteParams>,
): void {
  navigation.navigate('ChatThread', {
    ...chatThreadToRouteParams(thread),
    ...extra,
  });
}

type ChatNavigation = {
  navigate: (name: string, params?: object) => void;
  getParent?: () => ChatNavigation | undefined;
  replace?: (name: string, params?: object) => void;
  getState?: () => { index: number; routes: { name: string }[] };
};

/** Open a peer's public profile from a DM chat (Circles stack or modal overlay). */
export function openPeerProfileFromChat(
  navigation: ChatNavigation,
  userId: string,
  currentUserId: string | undefined | null,
  options?: { onClose?: () => void; returnTo?: UserProfileReturnTo },
) {
  const run = () => {
    navigateToPublicUserProfile(navigation, userId, currentUserId, options);
  };

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(run);
  } else {
    run();
  }
}
