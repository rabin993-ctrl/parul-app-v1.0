import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/fonts';
import { spacing } from '../theme/tokens';
import { Icon } from './icons/Icon';

const LOGO = require('../../assets/logo.png');

const PAW_COUNT = 3;

/**
 * Branded loading splash. Shows the logo + "connecting paws", with three paw
 * prints appearing one after another (in place of the usual loading dots) and
 * looping while the app initializes.
 */
export function AppSplash() {
  const { colors } = useTheme();
  // One animated value per paw, driving opacity + scale.
  const paws = useRef(
    Array.from({ length: PAW_COUNT }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    const fadeIn = paws.map(v =>
      Animated.timing(v, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    const reset = Animated.parallel(
      paws.map(v =>
        Animated.timing(v, {
          toValue: 0,
          duration: 220,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ),
    );

    const loop = Animated.loop(
      Animated.sequence([
        Animated.stagger(220, fadeIn),
        Animated.delay(450),
        reset,
        Animated.delay(180),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [paws]);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={styles.brand}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <Text style={[styles.wordmark, { color: colors.text }]}>Parul</Text>
      </View>

      <View style={styles.taglineRow}>
        <Text style={[styles.tagline, { color: colors.textSecondary }]}>connecting paws</Text>
        <View style={styles.paws}>
          {paws.map((v, i) => (
            <Animated.View
              key={i}
              style={{
                opacity: v,
                transform: [
                  { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
                  { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) },
                ],
              }}
            >
              <Icon name="paw" size={16} color={colors.primary} />
            </Animated.View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  brand: { alignItems: 'center', gap: spacing.sm },
  logo: { width: 112, height: 112 },
  wordmark: {
    fontSize: 34,
    fontFamily: fonts.bold,
    letterSpacing: -0.8,
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.xl2,
  },
  tagline: {
    fontSize: 15,
    fontFamily: fonts.medium,
    letterSpacing: 0.2,
  },
  paws: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    // Reserve width so the tagline doesn't shift as paws appear/disappear.
    width: PAW_COUNT * 21,
  },
});
