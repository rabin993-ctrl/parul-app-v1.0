import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { PAW_LOADER_TIMING } from '../theme/pawAnimation';
import { Icon } from './icons/Icon';

const PAW_COUNT = 3;
const { fadeInMs, fadeOutMs, staggerMs, holdMs, pauseMs } = PAW_LOADER_TIMING;

/**
 * Lightweight paw-themed loading indicator — three paw prints pulsing in a
 * rolling wave. Distinct from AppSplash (no logo / wordmark / tagline); used for
 * in-app loading states in place of a plain ActivityIndicator.
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
          duration: fadeInMs,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: fadeOutMs,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]);

    const loop = Animated.loop(
      Animated.sequence([
        Animated.stagger(staggerMs, paws.map(pulse)),
        Animated.delay(holdMs + pauseMs),
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
