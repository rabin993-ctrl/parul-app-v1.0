import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { getCirclesStackNavigation } from './circlesStackRouting';
import { getRootNavigation } from './notificationRouting';
import type { UserProfileReturnTo } from './userProfileBack';

type TabNavigation = {
  navigate: (name: string, params?: object) => void;
};

type NestedNavigation = TabNavigation & {
  getParent?: () => NestedNavigation | undefined;
};

/** Open own profile home or another user's public profile from a tab navigator. */
export function navigateToUserProfile(
  navigation: TabNavigation,
  userId: string,
  currentUserId: string | undefined | null,
  options?: { returnTo?: UserProfileReturnTo },
) {
  if (currentUserId && userId === currentUserId) {
    navigation.navigate('Profile', { screen: 'Home' });
    return;
  }
  navigation.navigate('Circles', {
    screen: 'UserProfile',
    params: { userId, ...(options?.returnTo ? { returnTo: options.returnTo } : {}) },
  });
}

/** Same as {@link navigateToUserProfile} from a nested stack (e.g. Profile tab). */
export function navigateToUserProfileFromNested(
  navigation: NestedNavigation,
  userId: string,
  currentUserId: string | undefined | null,
  options?: { returnTo?: UserProfileReturnTo },
) {
  const tabNav = navigation.getParent?.() ?? navigation;
  navigateToUserProfile(tabNav, userId, currentUserId, {
    returnTo: options?.returnTo ?? 'Profile',
  });
}

/**
 * Open a user's public profile from chat, inbox, or any nested navigator.
 * Prefers the Circles stack when available (same pattern as CircleChatScreen).
 */
export function navigateToPublicUserProfile(
  navigation: NestedNavigation,
  userId: string,
  currentUserId: string | undefined | null,
  options?: { returnTo?: UserProfileReturnTo; onClose?: () => void },
) {
  const returnTo = options?.returnTo ?? 'Hub';
  const params = { userId, returnTo };

  if (currentUserId && userId === currentUserId) {
    getRootNavigation(navigation).navigate('MainTabs', {
      screen: 'Profile',
      params: { screen: 'Home' },
    });
    return;
  }

  const circlesNav = getCirclesStackNavigation(navigation as NavigationProp<ParamListBase>);
  if (circlesNav) {
    circlesNav.navigate('UserProfile', params);
    return;
  }

  options?.onClose?.();
  getRootNavigation(navigation).navigate('MainTabs', {
    screen: 'Circles',
    params: { screen: 'UserProfile', params },
  });
}
