import React, { createContext, useCallback, useContext, useState } from 'react';
import type { HomeHubTab, HomeSectionTab } from '../components/ui/HomeHubDropdown';

type RegisteredFeedHubNavigation = {
  resetToFeed: () => void;
  selectSection: (tab: HomeSectionTab) => void;
};

let activeFeedHubRegistration: { id: number; nav: RegisteredFeedHubNavigation } | null = null;
let nextFeedHubRegistrationId = 0;

/** Register hub navigation handlers for the currently focused feed section screen. */
export function registerFeedHubNavigation(
  nav: RegisteredFeedHubNavigation | null,
  ownerId?: number,
) {
  if (nav != null && ownerId != null) {
    activeFeedHubRegistration = { id: ownerId, nav };
    return;
  }
  if (ownerId != null && activeFeedHubRegistration?.id === ownerId) {
    activeFeedHubRegistration = null;
  }
}

export function allocateFeedHubRegistrationId(): number {
  nextFeedHubRegistrationId += 1;
  return nextFeedHubRegistrationId;
}

function getRegisteredFeedHubNavigation(): RegisteredFeedHubNavigation | null {
  return activeFeedHubRegistration?.nav ?? null;
}

type HomeHubContextValue = {
  homeTab: HomeHubTab;
  setHomeTab: (tab: HomeHubTab) => void;
  selectSection: (tab: HomeSectionTab) => void;
  resetToFeed: () => void;
};

const HomeHubContext = createContext<HomeHubContextValue | null>(null);

export function HomeHubProvider({ children }: { children: React.ReactNode }) {
  const [homeTab, setHomeTab] = useState<HomeHubTab>('feed');

  const resetToFeed = useCallback(() => {
    getRegisteredFeedHubNavigation()?.resetToFeed();
    setHomeTab('feed');
  }, []);

  const selectSection = useCallback((tab: HomeSectionTab) => {
    getRegisteredFeedHubNavigation()?.selectSection(tab);
    setHomeTab(tab);
  }, []);

  const value = React.useMemo(
    () => ({ homeTab, setHomeTab, selectSection, resetToFeed }),
    [homeTab, selectSection, resetToFeed],
  );

  return (
    <HomeHubContext.Provider value={value}>
      {children}
    </HomeHubContext.Provider>
  );
}

export function useHomeHub() {
  const ctx = useContext(HomeHubContext);
  if (!ctx) throw new Error('useHomeHub must be used within HomeHubProvider');
  return ctx;
}
