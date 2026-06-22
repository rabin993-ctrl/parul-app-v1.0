import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Icon } from './icons/Icon';

const PAW_COUNT = 3;

/**
 * Lightweight paw-themed loading indicator — three paw prints pulsing in a
 * rolling wave. Distinct from AppSplash (no logo / wordmark / tagline); used for
 * in-app loading states in place of a plain ActivityIndicator.
 *
 * `fullScreen` (default) centers it on a themed background; pass false to drop it
 * inline wherever a spinner would go.
 */
export function PawLoader({
  size = 22,
  fullScreen = true,
  style,
}: {
  size?: number;
  fullScreen?: boolean;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const paws = useRef(
    Array.from({ length: PAW_COUNT }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    const pulse = (v: Animated.Value) =>
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: 260,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]);

    const loop = Animated.loop(
      Animated.sequence([
        Animated.stagger(170, paws.map(pulse)),
        Animated.delay(220),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [paws]);

  const content = (
    <View style={styles.paws}>
      {paws.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
            transform: [
              { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.15] }) },
              { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [3, -3] }) },
            ],
          }}
        >
          <Icon name="paw" size={size} color={colors.primary} />
        </Animated.View>
      ))}
    </View>
  );

  if (!fullScreen) return <View style={style}>{content}</View>;

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }, style]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  paws: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
