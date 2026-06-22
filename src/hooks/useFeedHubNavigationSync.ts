import { useCallback } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { HomeHubTab, HomeSectionTab } from '../components/ui/HomeHubDropdown';
import {
  allocateFeedHubRegistrationId,
  registerFeedHubNavigation,
  useHomeHub,
} from '../context/HomeHubContext';
import type { FeedStackParamList } from '../navigation/feedHubNavigation';
import { feedHubScreenForSection } from '../navigation/feedHubNavigation';

export function useFeedHubNavigationSync(activeHub: HomeHubTab) {
  const navigation = useNavigation<NativeStackNavigationProp<FeedStackParamList>>();
  const { setHomeTab } = useHomeHub();

  // Only the focused feed-section screen registers handlers. Using useEffect
  // caused a race: navigating FeedHome → RescueHub left FeedHome mounted
  // underneath, and its unmount cleanup (or a stale registration) could wipe
  // the active hub navigator and break section switching on web.
  useFocusEffect(
    useCallback(() => {
      const ownerId = allocateFeedHubRegistrationId();
      registerFeedHubNavigation({
        resetToFeed: () => navigation.navigate('FeedHome'),
        selectSection: (tab: HomeSectionTab) => {
          navigation.navigate(feedHubScreenForSection(tab));
        },
      }, ownerId);
      setHomeTab(activeHub);
      return () => registerFeedHubNavigation(null, ownerId);
    }, [activeHub, navigation, setHomeTab]),
  );
}
