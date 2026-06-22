import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/fonts';
import { radius, shadows, spacing } from '../../theme/tokens';
import type { lightColors } from '../../theme/tokens';
import { AppLogo } from '../ui/AppLogo';
import { Button } from '../ui/Button';
import { Icon } from '../icons/Icon';

type SlideAccent = 'primary' | 'accent' | 'success' | 'warning';

type Slide = {
  id: string;
  icon?: string;
  showLogo?: boolean;
  headline: string;
  body: string;
  accent: SlideAccent;
};

const SLIDES: Slide[] = [
  {
    id: 'welcome',
    showLogo: true,
    headline: 'Your pet community,\nright here.',
    body: 'Connect with pet lovers, help with adoption and rescue — all in one place.',
    accent: 'primary',
  },
  {
    id: 'connect',
    icon: 'home',
    headline: 'Follow friends.\nDiscover local circles.',
    body: 'Your feed shows what matters. Join neighborhood groups and chat in real time.',
    accent: 'accent',
  },
  {
    id: 'adopt',
    icon: 'heart',
    headline: 'Find a home.\nSave a life.',
    body: 'Browse adoption listings, submit applications, and respond to rescue alerts nearby.',
    accent: 'success',
  },
  {
    id: 'ready',
    icon: 'paw',
    headline: "You're all set.",
    body: 'Start exploring Parul — your pets (and new friends) are waiting.',
    accent: 'warning',
  },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MAX_WIDTH = 340;

function shade(hex: string, pct: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const f = pct < 0 ? 0 : 255;
  const t = Math.abs(pct) / 100;
  r = Math.round((f - r) * t) + r;
  g = Math.round((f - g) * t) + g;
  b = Math.round((f - b) * t) + b;
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function getAccent(
  accent: SlideAccent,
  colors: typeof lightColors,
): { main: string; soft: string; gradient: [string, string, string] } {
  switch (accent) {
    case 'accent':
      return {
        main: colors.accent,
        soft: colors.accent + '18',
        gradient: [colors.accent, shade(colors.accent, -10), colors.accentDark],
      };
    case 'success':
      return {
        main: colors.success,
        soft: colors.successBg,
        gradient: [shade(colors.success, 18), colors.success, shade(colors.success, -20)],
      };
    case 'warning':
      return {
        main: colors.warning,
        soft: colors.warningBg,
        gradient: [shade(colors.warning, 20), colors.warning, shade(colors.warning, -18)],
      };
    default:
      return {
        main: colors.primary,
        soft: colors.primary + '14',
        gradient: [colors.primaryLight, colors.primary, colors.primaryDark],
      };
  }
}

function SlideCard({ slide }: { slide: Slide }) {
  const { colors, isDark } = useTheme();
  const ac = getAccent(slide.accent, colors);

  return (
    <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
          shadows.md,
        ]}
      >
        {/* Visual */}
        <View style={styles.visual}>
          {slide.showLogo ? (
            <View style={[styles.logoWrap, { backgroundColor: ac.soft, borderColor: colors.border }]}>
              <AppLogo size={72} showWordmark />
            </View>
          ) : (
            <LinearGradient
              colors={ac.gradient}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.orb}
            >
              <Icon name={slide.icon!} size={42} color="#fff" sw={1.8} />
            </LinearGradient>
          )}
        </View>

        {/* Text */}
        <Text style={[styles.headline, { color: colors.text }]}>{slide.headline}</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>{slide.body}</Text>

        {/* Accent bar */}
        <LinearGradient
          colors={ac.gradient}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.accentBar}
        />
      </View>

      {/* Decorative orbs (light mode only) */}
      {!isDark && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[styles.decor1, { backgroundColor: ac.main + '10' }]} />
          <View style={[styles.decor2, { backgroundColor: colors.accent + '0D' }]} />
        </View>
      )}
    </View>
  );
}

export function AppTutorialCarousel({ onComplete }: { onComplete: () => void }) {
  const { colors, gradients } = useTheme();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);

  const isLast = index >= SLIDES.length - 1;

  const finish = useCallback(() => { void onComplete(); }, [onComplete]);

  const goNext = useCallback(() => {
    if (isLast) { finish(); return; }
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
  }, [finish, index, isLast]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const next = viewableItems[0]?.index;
    if (typeof next === 'number') setIndex(next);
  }).current;

  const onMomentumScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (Number.isFinite(next)) setIndex(next);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Slide }) => <SlideCard slide={item} />,
    [],
  );

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[...gradients.background.colors]}
        locations={[...gradients.background.locations]}
        start={gradients.background.start}
        end={gradients.background.end}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[...gradients.glow.colors]}
        locations={[...gradients.glow.locations]}
        start={gradients.glow.start}
        end={gradients.glow.end}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={[styles.badge, { backgroundColor: colors.infoBg, borderColor: colors.border }]}>
            <Icon name="sparkle" size={13} color={colors.primary} sw={2} />
            <Text style={[styles.badgeText, { color: colors.primary }]}>Quick tour</Text>
          </View>
          <Pressable
            onPress={finish}
            hitSlop={12}
            style={({ pressed }) => [
              styles.skipBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Skip tutorial"
          >
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
          </Pressable>
        </View>

        {/* Slides */}
        <FlatList
          ref={listRef}
          data={SLIDES}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          getItemLayout={(_, i) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * i, index: i })}
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />

        {/* Footer */}
        <View style={styles.footer}>
          {/* Dots */}
          <View style={styles.dots}>
            {SLIDES.map((slide, i) => (
              <View
                key={slide.id}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i === index ? colors.primary : colors.borderStrong,
                    width: i === index ? 22 : 7,
                    opacity: i === index ? 1 : 0.5,
                  },
                ]}
              />
            ))}
          </View>

          <Button full size="lg" onPress={goNext} iconRight={isLast ? undefined : 'arrowRight'}>
            {isLast ? 'Get started' : 'Next'}
          </Button>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeText: { fontSize: 12, fontFamily: fonts.semibold, letterSpacing: 0.2 },
  skipBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  skipText: { fontSize: 14, fontFamily: fonts.semibold },
  list: { flex: 1 },
  listContent: { alignItems: 'center' },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    position: 'relative',
  },
  card: {
    width: '100%',
    maxWidth: CARD_MAX_WIDTH,
    borderRadius: radius.xl2 ?? radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.xl2,
    paddingTop: spacing.xl2,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    overflow: 'hidden',
  },
  visual: { alignItems: 'center', marginBottom: spacing.sm },
  logoWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  orb: {
    width: 100,
    height: 100,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    fontSize: 28,
    fontFamily: fonts.bold,
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  body: {
    fontSize: 15,
    fontFamily: fonts.regular,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  accentBar: {
    height: 3,
    borderRadius: radius.full,
    marginTop: spacing.xs,
    marginHorizontal: -spacing.xl2,
  },
  decor1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: radius.full,
    top: '5%',
    right: '-20%',
  },
  decor2: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: radius.full,
    bottom: '10%',
    left: '-18%',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 7,
    borderRadius: radius.full,
  },
});
