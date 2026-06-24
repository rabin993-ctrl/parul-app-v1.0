import React from 'react';
import { Image, Pressable, StyleSheet, Text, View, Platform } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

const LOGO = require('../../../assets/logo.png');

type AppLogoProps = {
  size?: number;
  showWordmark?: boolean;
  tagline?: string;
  onPress?: () => void;
};

export function AppLogo({ size = 44, showWordmark = false, tagline, onPress }: AppLogoProps) {
  const { colors } = useTheme();

  const content = showWordmark ? (
    <View style={[styles.wrap, tagline ? styles.wrapWithTagline : null]}>
      <Image
        source={LOGO}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
      <View style={styles.wordmarkCol}>
        <Text style={[
          tagline ? styles.nameCompact : styles.name,
          { color: colors.text },
        ]}>
          Parul
        </Text>
        {tagline ? (
          <Text style={[styles.tagline, { color: colors.textSecondary }]} numberOfLines={1}>
            {tagline}
          </Text>
        ) : null}
      </View>
    </View>
  ) : (
    <Image
      source={LOGO}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tagline ? 'Parul, Connecting paws' : 'Go to feed'}
      style={({ pressed }) => [
        pressed && styles.pressed,
        Platform.OS === 'web' && styles.pressableWeb,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  wrapWithTagline: { gap: 8 },
  wordmarkCol: { gap: 1, minWidth: 0 },
  name: {
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 24,
    marginLeft: -2,
    marginTop: 2,
  },
  nameCompact: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.45,
    lineHeight: 21,
  },
  tagline: {
    fontSize: 11.5,
    fontWeight: '500',
    letterSpacing: -0.1,
    lineHeight: 14,
  },
  pressed: { opacity: 0.72 },
  pressableWeb: { cursor: 'pointer' as const },
});
