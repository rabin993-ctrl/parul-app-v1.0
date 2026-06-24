import React from 'react';
import type { AuthorProfile } from '../../data/communityPosts';
import { UserNameWithAdoptionFlag } from './UserNameWithAdoptionFlag';

export function CommentAuthorLine({
  userId,
  authorProfile,
  fontSize = 14,
  onAuthorPress,
}: {
  userId: string;
  authorProfile?: AuthorProfile;
  fontSize?: number;
  onAuthorPress?: (userId: string) => void;
  onCompanionPress?: (companionId: string) => void;
}) {
  const displayName = authorProfile?.name ?? authorProfile?.handle ?? userId;

  return (
    <UserNameWithAdoptionFlag
      userId={userId}
      name={displayName}
      numberOfLines={1}
      nameStyle={{ fontSize, lineHeight: fontSize + 6 }}
      onPress={onAuthorPress ? () => onAuthorPress(userId) : undefined}
    />
  );
}
