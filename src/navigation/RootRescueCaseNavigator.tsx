import React from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useRoute } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { RescueCaseDetailScreen } from '../screens/profile/RescueCaseDetailScreen';
import { RescuePostUpdateScreen } from '../screens/rescue/RescuePostUpdateScreen';
import type { RescueStackParamList } from './RescueNavigator';

export type RootRescueCaseFlowParams = {
  caseId: string;
  openHelpOffers?: boolean;
};

const Stack = createNativeStackNavigator<RescueStackParamList>();

/** Standalone rescue case stack — no Rescue hub chrome (chat, notifications, etc.). */
export function RootRescueCaseNavigator() {
  const { colors } = useTheme();
  const route = useRoute();
  const { caseId, openHelpOffers } = route.params as RootRescueCaseFlowParams;

  return (
    <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg, flex: 1 },
          animation: Platform.OS === 'web' ? 'none' : 'slide_from_right',
        }}
        initialRouteName="Detail"
      >
        <Stack.Screen
          name="Detail"
          component={RescueCaseDetailScreen}
          initialParams={
            openHelpOffers
              ? { caseId, openHelpOffers: true as const }
              : { caseId }
          }
        />
        <Stack.Screen name="PostUpdate" component={RescuePostUpdateScreen} />
      </Stack.Navigator>
  );
}
