import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { radius } from '../../theme/tokens';
import { PawLoader } from '../PawLoader';
import { PUBLISH_LABELS } from '../../types/publishStatus';

type Variant = 'banner' | 'media' | 'full';

export function PublishingOverlay({
  visible,
  label = PUBLISH_LABELS.feed,
  variant = 'banner',
  style,
}: {
  visible: boolean;
  label?: string;
  variant?: Variant;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      opacity.setValue(1);
      return;
    }
    Animated.timing(opacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [visible, opacity]);

  if (!mounted) return null;

  const content = (
    <View style={styles.content}>
      <PawLoader size={18} fullScreen={false} />
      <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );

  if (variant === 'banner') {
    return (
      <Animated.View
        style={[
          styles.banner,
          { backgroundColor: colors.surface, borderBottomColor: colors.border, opacity },
          style,
        ]}
        pointerEvents="none"
      >
        {content}
      </Animated.View>
    );
  }

  const scrimBg = variant === 'media' ? 'rgba(0,0,0,0.45)' : colors.bg + 'B3';

  return (
    <Animated.View
      style={[
        styles.overlay,
        variant === 'media' && styles.mediaOverlay,
        { backgroundColor: scrimBg, opacity },
        style,
      ]}
      pointerEvents="none"
    >
      {content}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    zIndex: 2,
  },
  mediaOverlay: {
    borderRadius: radius.lg,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
});
