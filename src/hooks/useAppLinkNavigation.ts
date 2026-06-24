import { useCallback } from 'react';
import { Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { navigateToUserProfile } from '../navigation/userProfileRouting';
import { parseAppShareUrl } from '../utils/linkText';

type ReturnTo = 'Feed' | 'Hub' | 'Messages' | 'Profile';

export function useAppLinkNavigation(options?: {
  returnTo?: ReturnTo;
  onBeforeNavigate?: () => void;
}) {
  const navigation = useNavigation<{ navigate: (name: string, params?: object) => void; getParent?: () => { navigate: (name: string, params?: object) => void } | undefined }>();
  const { user } = useAuth();

  return useCallback((url: string) => {
    const target = parseAppShareUrl(url);
    if (!target) return;

    if (target.type === 'external') {
      void Linking.openURL(target.url);
      return;
    }

    options?.onBeforeNavigate?.();
    const tabNav = navigation.getParent?.() ?? navigation;
    const returnTo = options?.returnTo ?? 'Feed';

    switch (target.type) {
      case 'companion':
        tabNav.navigate('Profile', {
          screen: 'Companion',
          params: { companionId: target.companionId },
        });
        break;
      case 'user':
        navigateToUserProfile(tabNav, target.userId, user?.id, { returnTo });
        break;
      case 'feedPost':
        tabNav.navigate('Feed', {
          screen: 'FeedPostDetail',
          params: { postId: target.postId },
        });
        break;
      case 'profileFeedPost':
        tabNav.navigate('Profile', {
          screen: 'FeedPostDetail',
          params: { postId: target.postId },
        });
        break;
      case 'communityPost':
        tabNav.navigate('Community', {
          screen: 'PostDetail',
          params: { postId: target.postId },
        });
        break;
      default:
        break;
    }
  }, [navigation, options?.onBeforeNavigate, options?.returnTo, user?.id]);
}
