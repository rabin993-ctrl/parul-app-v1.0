import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, ActivityIndicator, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../../theme/ThemeContext';
import { Toast, ToastData } from '../../components/ui/Toast';
import { ProfileSubHeader } from '../../components/profile/ProfileChrome';
import { AdoptedCareProfile } from '../../components/profile/AdoptedCareProfile';
import { useAdoption } from '../../context/AdoptionContext';
import { useUserProfile } from '../../hooks/useUserProfile';
import { canAdopterPostUpdate } from '../../utils/adoptionUpdateSchedule';
import { useCurrentUserProfile } from '../../context/CurrentUserProfileContext';
import { useTabBarScrollPadding } from '../../navigation/tabBarInsets';
import { useAdoptedDetailBack } from '../../navigation/adoptedDetailBack';
import { navigateToUserProfileFromNested } from '../../navigation/userProfileRouting';
import { navigateToAdoptionListingFromNested } from '../../navigation/adoptionListingRouting';
import { fetchPublicAdoptionRecord } from '../../lib/publicProfileAdoptions';
import type { AdoptionRecord } from '../../data/adoptionRecords';

type AdoptedDetailParams = {
  recordId: string;
  openOwnerPost?: boolean;
};

export function AdoptedDetailScreen() {
  const { colors } = useTheme();
  const route = useRoute();
  const navigation = useNavigation();
  const handleBack = useAdoptedDetailBack();
  const { recordId } = route.params as AdoptedDetailParams;
  const tabBarPad = useTabBarScrollPadding();
  const { me } = useCurrentUserProfile();
  const {
    records,
    submitAdopterUpdate,
    submitPosterEndorsement,
    submitAdopterResponse,
  } = useAdoption();
  const contextRecord = records.find(r => r.id === recordId);
  const [fetchedRecord, setFetchedRecord] = useState<AdoptionRecord | null>(null);
  const [loadingPublic, setLoadingPublic] = useState(
    () => route.name === 'PublicAdoptedDetail' && !contextRecord,
  );
  const record = contextRecord ?? fetchedRecord;
  const adopterProfile = useUserProfile(record?.adopterId);

  const [toast, setToast] = useState<ToastData | null>(null);

  const viewerId = me.id;

  useEffect(() => {
    if (contextRecord || route.name !== 'PublicAdoptedDetail') {
      setLoadingPublic(false);
      return;
    }
    let cancelled = false;
    setLoadingPublic(true);
    void fetchPublicAdoptionRecord(recordId).then(next => {
      if (!cancelled) {
        setFetchedRecord(next);
        setLoadingPublic(false);
      }
    });
    return () => { cancelled = true; };
  }, [contextRecord, recordId, route.name]);

  if (loadingPublic) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
        <ProfileSubHeader title="Adoption" onBack={handleBack} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!record) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
        <ProfileSubHeader title="Adoption" onBack={handleBack} />
        <View style={styles.center}>
          <Text style={{ color: colors.textSecondary }}>This placement is no longer available.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isAdopter = record.adopterId === viewerId;
  const isPoster = record.posterId === viewerId;

  const title = record.petName;

  const handleSubmitRecommendation = (
    recommendation: 'recommended' | 'not_recommended',
    text?: string,
  ) => {
    submitPosterEndorsement(record.id, recommendation, text);
    const adopterHandle = adopterProfile?.handle ?? record.adopterId.slice(0, 8);
    setToast({
      msg: recommendation === 'recommended'
        ? `Recommended @${adopterHandle}`
        : `Not recommended @${adopterHandle}`,
      icon: recommendation === 'recommended' ? 'heart' : 'alert',
      tone: recommendation === 'recommended' ? 'success' : 'danger',
    });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top']}>
      <ProfileSubHeader title={title} onBack={handleBack} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarPad }]}
        showsVerticalScrollIndicator={false}
      >
        <AdoptedCareProfile
          record={record}
          viewerId={viewerId}
          onUserPress={id => navigateToUserProfileFromNested(navigation, id, viewerId)}
          onOpenRecord={id => {
            if (id === recordId) return;
            (navigation as any).push(route.name, { recordId: id });
          }}
          onOpenListing={id => navigateToAdoptionListingFromNested(navigation as any, id)}
          onSubmitUpdate={isAdopter && canAdopterPostUpdate(record) ? payload => {
            submitAdopterUpdate(record.id, payload);
            setToast({ msg: `Update posted for ${record.petName}`, icon: 'check', tone: 'success' });
          } : undefined}
          onSubmitRecommendation={isPoster ? handleSubmitRecommendation : undefined}
          onSubmitAdopterResponse={isAdopter ? text => {
            submitAdopterResponse(record.id, text);
            setToast({ msg: 'Response posted', icon: 'check', tone: 'success' });
          } : undefined}
        />
      </ScrollView>

      <Toast data={toast} onHide={() => setToast(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
