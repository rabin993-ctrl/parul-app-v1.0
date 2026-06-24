import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { navigateToPublicUserProfile } from './userProfileRouting';
import type { UserProfileReturnTo } from './userProfileBack';

type Nav = NavigationProp<ParamListBase> & {
  getParent?: () => Nav | undefined;
};

/** Open a comment author's profile from the feed comments sheet (cross-tab on web). */
export function openCommentAuthorProfile(
  navigation: Nav,
  userId: string,
  currentUserId: string | undefined | null,
  options?: { returnTo?: UserProfileReturnTo },
) {
  if (!userId) return;
  navigateToPublicUserProfile(navigation, userId, currentUserId, {
    returnTo: options?.returnTo ?? 'Feed',
  });
}
