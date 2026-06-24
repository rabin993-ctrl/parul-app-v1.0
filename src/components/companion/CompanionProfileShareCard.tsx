import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius } from '../../theme/tokens';
import { CompanionAvatar } from '../ui/Avatar';
import { ChatAttachmentCard, ChatAttachmentOpenLink } from '../chat/ChatAttachmentCard';
import { formatCompanionHandleLabel } from '../../utils/companionHandle';
import type { Companion } from '../../data/mockData';
import type { CompanionProfileSharePreview } from '../../utils/shareCompanionProfile';

const THUMB_SIZE = 96;

type Props = {
  companionId: string;
  companion?: Companion | null;
  preview?: CompanionProfileSharePreview;
  tint: string;
  onPress?: () => void;
  maxWidth?: number;
};

function formatMetaLine(companion?: Companion | null, preview?: CompanionProfileSharePreview): string {
  if (companion) {
    const parts = [
      companion.breed && companion.breed !== '—' ? companion.breed : null,
      companion.age && companion.age !== '—' ? companion.age : null,
      companion.species && companion.species !== '—' ? companion.species : null,
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(' · ');
  }
  return preview?.metaLine?.trim() ?? '';
}

export function CompanionProfileShareCard({
  companionId,
  companion,
  preview,
  tint,
  onPress,
  maxWidth,
}: Props) {
  const { colors } = useTheme();

  const cardTint = companion?.tint ?? tint;
  const name = companion?.name ?? preview?.name ?? 'Companion';
  const handleLabel = companion
    ? formatCompanionHandleLabel(companion.handle, companion.name)
    : (preview?.handleLabel ?? '');
  const metaLine = formatMetaLine(companion, preview);
  const bioSnippet = (
    companion?.about?.trim()
    || preview?.bioSnippet
    || ''
  ).slice(0, 100);

  const avatarCompanion: Companion = companion ?? {
    id: companionId,
    name,
    species: 'dog',
    icon: 'paw',
    breed: '—',
    age: '—',
    gender: '—',
    owner: '',
    ownerId: '',
    tint: cardTint,
    traits: [],
    vaccinated: false,
    neutered: false,
    microchipped: false,
    about: '',
    handle: preview?.handleLabel?.replace(/^#/, ''),
    mood: '',
    followers: 0,
    pawprints: 0,
    treats: 0,
    postsCount: 0,
    siblings: [],
    online: false,
    verified: false,
  };

  return (
    <View style={[styles.wrap, maxWidth ? { width: maxWidth } : null]}>
      <ChatAttachmentCard
        label="Companion profile"
        onPress={onPress}
        accessibilityLabel="Open companion profile"
        maxWidth={maxWidth}
        footer={onPress ? <ChatAttachmentOpenLink label="Open profile" tint={cardTint} /> : null}
      >
        <View style={styles.row}>
          <View style={styles.thumbWrap}>
            <CompanionAvatar companion={avatarCompanion} size={THUMB_SIZE} />
          </View>

          <View style={styles.body}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {name}
            </Text>
            {handleLabel ? (
              <Text style={[styles.handle, { color: cardTint }]} numberOfLines={1}>
                {handleLabel}
              </Text>
            ) : null}

            {metaLine ? (
              <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
                {metaLine}
              </Text>
            ) : null}

            {bioSnippet ? (
              <Text style={[styles.bio, { color: colors.textSecondary }]} numberOfLines={2}>
                {bioSnippet}
              </Text>
            ) : null}
          </View>
        </View>
      </ChatAttachmentCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  thumbWrap: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    justifyContent: 'center',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  handle: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  bio: {
    fontSize: 12.5,
    lineHeight: 17,
  },
});
