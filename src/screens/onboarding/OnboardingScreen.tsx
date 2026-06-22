import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/fonts';
import { radius, spacing, MOBILE_INPUT_FONT_SIZE } from '../../theme/tokens';
import { AppLogo } from '../../components/ui/AppLogo';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/icons/Icon';
import { useCurrentUserProfile } from '../../context/CurrentUserProfileContext';
import { isUsernameAvailable, USERNAME_RE } from '../../utils/username';

type UsernameStatus = 'idle' | 'invalid' | 'checking' | 'available' | 'taken';

/** Shown once to new OAuth (Google) users so they pick a username + confirm name. */
export function OnboardingScreen() {
  const { colors, gradients, isDark } = useTheme();
  const { me, completeOnboarding } = useCurrentUserProfile();

  const [name, setName] = useState(me.name ?? '');
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState<UsernameStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Prefill name from Google profile once it loads.
  useEffect(() => { if (me.name) setName(me.name); }, [me.name]);

  // Live username availability check (debounced).
  useEffect(() => {
    if (username.length === 0) { setStatus('idle'); return; }
    if (!USERNAME_RE.test(username)) { setStatus('invalid'); return; }
    setStatus('checking');
    let cancelled = false;
    const t = setTimeout(async () => {
      const ok = await isUsernameAvailable(username);
      if (!cancelled) setStatus(ok === null ? 'idle' : ok ? 'available' : 'taken');
    }, 450);
    return () => { cancelled = true; clearTimeout(t); };
  }, [username]);

  async function onSubmit() {
    if (name.trim().length < 2) { setError('Please enter your name.'); return; }
    if (!USERNAME_RE.test(username)) {
      setError('Username must be 3–20 characters: letters, numbers, or _.');
      return;
    }
    if (status === 'taken') { setError('That username is taken — please choose another.'); return; }
    setError(null);
    setLoading(true);
    try {
      await completeOnboarding(username, name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  const inputStyle = [
    styles.input,
    {
      backgroundColor: isDark ? colors.surface2 : colors.surface,
      color: colors.text,
      borderColor: colors.border,
    },
    Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
  ];

  const canSubmit = name.trim().length >= 2
    && USERNAME_RE.test(username)
    && status !== 'taken'
    && status !== 'checking';

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[...gradients.background.colors]}
        locations={[...gradients.background.locations]}
        start={gradients.background.start}
        end={gradients.background.end}
        style={StyleSheet.absoluteFill}
      />
      {!isDark && (
        <LinearGradient
          colors={[...gradients.glow.colors]}
          locations={[...gradients.glow.locations]}
          start={gradients.glow.start}
          end={gradients.glow.end}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <AppLogo size={52} showWordmark />
              <View style={[styles.iconRing, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '30' }]}>
                <Icon name="paw" size={36} color={colors.primary} />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>One last step</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Pick a username and confirm your name to complete your Parul profile.
              </Text>
            </View>

            {/* Card */}
            <View style={[styles.card, { backgroundColor: isDark ? colors.surface : colors.bg, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Full name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={colors.textTertiary}
                style={inputStyle}
                autoCapitalize="words"
                autoComplete="name"
              />

              <Text style={[styles.label, { color: colors.textSecondary, marginTop: spacing.md }]}>
                Username
              </Text>
              <View style={[
                styles.usernameRow,
                {
                  backgroundColor: isDark ? colors.surface2 : colors.surface,
                  borderColor: status === 'available'
                    ? colors.success
                    : status === 'taken'
                      ? colors.danger
                      : colors.border,
                },
              ]}>
                <Text style={[styles.prefix, { color: colors.textTertiary }]}>@</Text>
                <TextInput
                  value={username}
                  onChangeText={t => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="yourusername"
                  placeholderTextColor={colors.textTertiary}
                  style={[
                    styles.usernameInput,
                    { color: colors.text },
                    Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
                  ]}
                  autoCapitalize="none"
                  autoComplete="username"
                />
                {status === 'available' && (
                  <Icon name="check" size={18} color={colors.success} sw={2.5} />
                )}
                {status === 'checking' && (
                  <Icon name="refresh" size={16} color={colors.textTertiary} />
                )}
              </View>

              {status === 'checking' && (
                <Text style={[styles.hint, { color: colors.textSecondary }]}>Checking availability…</Text>
              )}
              {status === 'available' && (
                <Text style={[styles.hint, { color: colors.success }]}>@{username} is available</Text>
              )}
              {status === 'taken' && (
                <Text style={[styles.hint, { color: colors.danger }]}>@{username} is taken — try another</Text>
              )}
              {status === 'invalid' && username.length > 0 && (
                <Text style={[styles.hint, { color: colors.textTertiary }]}>
                  3–20 characters: letters, numbers, or _
                </Text>
              )}

              {error && (
                <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
              )}
            </View>

            <Button
              full
              size="lg"
              loading={loading}
              onPress={onSubmit}
              style={styles.submit}
            >
              Finish setup
            </Button>

            <Text style={[styles.legal, { color: colors.textTertiary }]}>
              Your username can be changed later in Profile settings.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl2,
    gap: spacing.lg,
  },
  header: { alignItems: 'center', gap: spacing.md },
  iconRing: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  title: {
    fontSize: 26,
    fontFamily: fonts.bold,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14.5,
    fontFamily: fonts.regular,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.xl,
  },
  label: { fontSize: 12.5, fontFamily: fonts.semibold, letterSpacing: 0.2, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: MOBILE_INPUT_FONT_SIZE,
    fontFamily: fonts.regular,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  prefix: { fontSize: MOBILE_INPUT_FONT_SIZE, fontFamily: fonts.medium },
  usernameInput: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    paddingLeft: 2,
    fontSize: MOBILE_INPUT_FONT_SIZE,
    fontFamily: fonts.regular,
  },
  hint: { fontSize: 12.5, fontFamily: fonts.medium, marginTop: 6 },
  error: { fontSize: 13.5, fontFamily: fonts.medium, marginTop: spacing.sm },
  submit: { borderRadius: radius.lg },
  legal: {
    fontSize: 12,
    fontFamily: fonts.regular,
    textAlign: 'center',
    lineHeight: 17,
  },
});
