import React from 'react';
import { Platform } from 'react-native';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeContext';
import { EmbeddedStackDeepLinkBridge } from './embeddedStackDeepLink';
import { RescueListingScreen } from '../screens/rescue/RescueListingScreen';
import { RescueSearchScreen } from '../screens/rescue/RescueSearchScreen';
import { RescueCreateCaseScreen } from '../screens/rescue/RescueCreateCaseScreen';
import { RescuePostUpdateScreen } from '../screens/rescue/RescuePostUpdateScreen';
import { RescueCaseDetailScreen } from '../screens/profile/RescueCaseDetailScreen';
import type { RescueFilters, RescueHubTab } from '../data/rescueData';

export type RescueStackParamList = {
  Listing: undefined;
  Detail: { caseId: string; openHelpOffers?: boolean };
  PostUpdate: { caseId: string };
  Search: { species?: RescueFilters['species'] };
  CreateCase: undefined;
};

const Stack = createNativeStackNavigator<RescueStackParamList>();

export function RescueNavigator({
  embedded = false,
  scrollHeader,
  openCreateOnMount = false,
  onOpenCreateHandled,
  hubTab,
  onHubTabChange,
  hubBarPinned = false,
  filters,
  onFiltersChange,
  deepLink,
  onDeepLinkHandled,
}: {
  embedded?: boolean;
  scrollHeader?: React.ReactNode;
  openCreateOnMount?: boolean;
  onOpenCreateHandled?: () => void;
  hubTab?: RescueHubTab;
  onHubTabChange?: (tab: RescueHubTab) => void;
  hubBarPinned?: boolean;
  filters?: RescueFilters;
  onFiltersChange?: (filters: RescueFilters) => void;
  deepLink?: NavigatorScreenParams<RescueStackParamList>;
  onDeepLinkHandled?: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg, flex: 1 },
        animation: Platform.OS === 'web' ? 'none' : 'slide_from_right',
      }}
      screenLayout={({ children }) => (
        <>
          <EmbeddedStackDeepLinkBridge
            deepLink={deepLink}
            onHandled={onDeepLinkHandled}
          />
          {children}
        </>
      )}
    >
      <Stack.Screen name="Listing">
        {() => (
          <RescueListingScreen
            embedded={embedded}
            scrollHeader={scrollHeader}
            openCreateOnMount={openCreateOnMount}
            onOpenCreateHandled={onOpenCreateHandled}
            hubTab={hubTab}
            onHubTabChange={onHubTabChange}
            hubBarPinned={hubBarPinned}
            filters={filters}
            onFiltersChange={onFiltersChange}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Detail" component={RescueCaseDetailScreen} />
      <Stack.Screen name="PostUpdate" component={RescuePostUpdateScreen} />
      <Stack.Screen name="Search" component={RescueSearchScreen} />
      <Stack.Screen name="CreateCase" component={RescueCreateCaseScreen} />
    </Stack.Navigator>
  );
}
