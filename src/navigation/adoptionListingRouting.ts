type TabNavigation = {
  navigate: (name: string, params?: object) => void;
  getState?: () => {
    type?: string;
    index: number;
    routes: { name: string; state?: unknown; params?: object }[];
  };
};

type NestedNavigation = TabNavigation & {
  getParent?: () => NestedNavigation | undefined;
};

export type AdoptionListingReturnTo = {
  tab: 'Feed' | 'Profile' | 'Circles' | 'Community' | 'Vet';
  screen: string;
  params?: Record<string, unknown>;
};

function getTabNavigator(navigation: NestedNavigation): TabNavigation | undefined {
  let nav: NestedNavigation | undefined = navigation;
  while (nav) {
    const state = nav.getState?.();
    if (state?.type === 'tab') return nav;
    nav = nav.getParent?.();
  }
  return undefined;
}

/** Embedded adoption stack inside AdoptionHub (Listing, Detail, AdoptedDetail, …). */
function getAdoptionStackNavigation(navigation: NestedNavigation): NestedNavigation | undefined {
  const routes = navigation.getState?.()?.routes ?? [];
  const names = routes.map(route => route.name);
  if (names.includes('Listing') && names.includes('Detail') && names.includes('Confirmation')) {
    return navigation;
  }
  return undefined;
}

/** Feed tab stack (FeedHome, AdoptionHub, RescueHub, …). */
function getFeedStackNavigation(navigation: NestedNavigation): NestedNavigation | undefined {
  let nav: NestedNavigation | undefined = navigation;
  for (let depth = 0; depth < 6 && nav; depth += 1) {
    const names = (nav.getState?.()?.routes ?? []).map(route => route.name);
    if (names.includes('AdoptionHub') && names.includes('FeedHome')) {
      return nav;
    }
    nav = nav.getParent?.();
  }
  return undefined;
}

function adoptionListingDetailParams(
  listingId: string,
  returnTo?: AdoptionListingReturnTo,
) {
  return {
    listingId,
    ...(returnTo ? { returnTo } : {}),
  };
}

/** Remember where the user was before opening an adoption listing detail cross-tab. */
export function captureAdoptionListingReturnTo(
  navigation: NestedNavigation,
): AdoptionListingReturnTo | undefined {
  const stackState = navigation.getState?.();
  if (!stackState) return undefined;

  const currentRoute = stackState.routes[stackState.index ?? 0];
  if (!currentRoute?.name) return undefined;

  const tabNav = getTabNavigator(navigation);
  if (!tabNav) return undefined;

  const tabState = tabNav.getState?.();
  if (!tabState) return undefined;

  const tabRoute = tabState.routes[tabState.index ?? 0];
  if (!tabRoute?.name) return undefined;

  if (tabRoute.name === 'Feed') {
    const feedState = tabRoute.state as {
      routes?: { name: string; state?: { routes?: { name: string }[]; index?: number } }[];
      index?: number;
    } | undefined;
    const feedRoute = feedState?.routes?.[feedState.index ?? 0];
    if (feedRoute?.name === 'AdoptionHub') {
      const adoptionState = feedRoute.state;
      const adoptionRoute = adoptionState?.routes?.[adoptionState.index ?? 0];
      if (adoptionRoute?.name === 'Listing') {
        return undefined;
      }
    }
  }

  return {
    tab: tabRoute.name as AdoptionListingReturnTo['tab'],
    screen: currentRoute.name,
    params: currentRoute.params as Record<string, unknown> | undefined,
  };
}

/** Open an adoption listing detail from any nested navigator. */
export function navigateToAdoptionListing(
  navigation: TabNavigation,
  listingId: string,
  returnTo?: AdoptionListingReturnTo,
) {
  navigation.navigate('Feed', {
    screen: 'AdoptionHub',
    params: {
      screen: 'Detail',
      params: {
        listingId,
        ...(returnTo ? { returnTo } : {}),
      },
    },
  });
}

export function navigateToAdoptionListingFromNested(
  navigation: NestedNavigation,
  listingId: string,
) {
  const adoptionStack = getAdoptionStackNavigation(navigation);
  if (adoptionStack) {
    // Already inside AdoptionHub's embedded stack — push Detail directly.
    adoptionStack.navigate('Detail', adoptionListingDetailParams(listingId));
    return;
  }

  const returnTo = captureAdoptionListingReturnTo(navigation);
  const detailParams = adoptionListingDetailParams(listingId, returnTo);

  const feedStack = getFeedStackNavigation(navigation);
  if (feedStack) {
    // On the Feed stack (e.g. Search) — same pattern as FeedSearchScreen.
    feedStack.navigate('AdoptionHub', {
      screen: 'Detail',
      params: detailParams,
    });
    return;
  }

  const tabNav = getTabNavigator(navigation) ?? navigation.getParent?.() ?? navigation;
  navigateToAdoptionListing(tabNav, listingId, returnTo);
}
