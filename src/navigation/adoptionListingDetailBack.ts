import { useCallback } from 'react';
import { StackActions, useNavigation } from '@react-navigation/native';
import type { AdoptionListingReturnTo } from './adoptionListingRouting';

/** Pop within the adoption stack, or return to the screen that opened this listing. */
export function useAdoptionListingDetailBack(returnTo?: AdoptionListingReturnTo) {
  const navigation = useNavigation();

  return useCallback(() => {
    const state = navigation.getState();
    if (state && state.index > 0) {
      navigation.dispatch(StackActions.pop());
      return;
    }

    if (returnTo) {
      const feedNav = navigation.getParent();
      const tabNav = feedNav?.getParent();
      (tabNav as any)?.navigate(returnTo.tab, { screen: returnTo.screen, params: returnTo.params });
      return;
    }

    if (navigation.canGoBack()) {
      navigation.dispatch(StackActions.pop());
      return;
    }

    const feedNav = navigation.getParent();
    (feedNav as any)?.navigate('AdoptionHub', { screen: 'Listing' });
  }, [navigation, returnTo]);
}
