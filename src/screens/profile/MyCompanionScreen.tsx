import React, { useCallback, useEffect, useState } from 'react';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompanionFullProfile } from '../../components/CompanionProfile';
import { Toast, ToastData } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import { useCurrentUserProfile } from '../../context/CurrentUserProfileContext';
import { closeCompanionScreen } from '../../navigation/companionProfileRouting';
import { navigateToUserProfileFromNested } from '../../navigation/userProfileRouting';
import type { ProfileStackParamList } from '../../navigation/ProfileNavigator';

type Route = RouteProp<ProfileStackParamList, 'Companion'>;
type Nav = NativeStackNavigationProp<ProfileStackParamList, 'Companion'>;

export function MyCompanionScreen() {
  const navigation = useNavigation<Nav>();
  const { companionId } = useRoute<Route>().params;
  const { user } = useAuth();
  const { me } = useCurrentUserProfile();
  const [activeId, setActiveId] = useState(companionId);
  const [toast, setToast] = useState<ToastData | null>(null);
  const currentUserId = me.id || user?.id;

  useEffect(() => {
    setActiveId(companionId);
  }, [companionId]);

  const handleSwitchCompanion = useCallback((id: string) => {
    setActiveId(id);
    navigation.setParams({ companionId: id });
  }, [navigation]);

  const handleOpenPostDetail = useCallback((postId: string, cid: string) => {
    navigation.navigate('CompanionPostDetail', { postId, companionId: cid });
  }, [navigation]);

  const handleOwnerPress = useCallback((ownerId: string) => {
    navigateToUserProfileFromNested(navigation, ownerId, currentUserId);
  }, [currentUserId, navigation]);

  return (
    <>
      <CompanionFullProfile
        companionId={activeId}
        visible
        onClose={() => closeCompanionScreen(navigation)}
        onSwitchCompanion={handleSwitchCompanion}
        onOwnerPress={handleOwnerPress}
        onToast={setToast}
        onOpenPostDetail={handleOpenPostDetail}
      />
      <Toast data={toast} onHide={() => setToast(null)} />
    </>
  );
}
