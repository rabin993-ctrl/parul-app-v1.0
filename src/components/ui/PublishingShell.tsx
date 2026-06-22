import React from 'react';
import { View, type ViewStyle } from 'react-native';
import type { PublishStatus } from '../../types/publishStatus';
import { PublishingOverlay } from './PublishingOverlay';

export function PublishingShell({
  publishStatus,
  label,
  children,
  style,
}: {
  publishStatus?: PublishStatus;
  label?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const uploading = publishStatus === 'uploading';

  return (
    <View style={style}>
      {uploading ? (
        <PublishingOverlay visible label={label} variant="banner" />
      ) : null}
      <View
        style={uploading ? { opacity: 0.88 } : undefined}
        pointerEvents={uploading ? 'none' : 'auto'}
      >
        {children}
      </View>
    </View>
  );
}
