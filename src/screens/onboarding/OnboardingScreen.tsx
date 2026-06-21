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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/fonts';
import { radius, spacing, MOBILE_INPUT_FONT_SIZE } from '../../theme/tokens';
import { AppLogo } from '../../components/ui/AppLogo';
import { Button } from '../../components/ui/Button';
import { useCurrentUserProfile } from '../../context/CurrentUserProfileContext';
import { isUsernameAvailable, USERNAME_RE } from '../../utils/username';

type UsernameStatus = 'idle' | 'invalid' | 'checking' | 'available' | 'taken';

/** Shown once to new OAuth (Google) users so they pick a username + confirm name. */
export function OnboardingScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { me, completeOnboarding } = useCurrentUserProfile();

  const [name, setName] = useState(me.name ?? '');
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState<UsernameStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Prefill the name from the Google profile once it loads.
  useEffect(() => { if (me.name) setName(me.name); }, [me.name]);

  // Live username availability check (debounced); `username` is already normalized.
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
      // On success the app un-gates this screen automatically (onboarded -> true).
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  const inputStyle = [
    styles.input,
    { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
    Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <AppLogo />
        <Text style={[styles.title, { color: colors.text }]}>Welcome to Parul</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Pick a username and confirm your name to finish setting up your profile.
        </Text>

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

        <Text style={[styles.label, { color: colors.textSecondary }]}>Username</Text>
        <View style={[styles.usernameRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
        </View>
        {status === 'checking' && (
          <Text style={[styles.hint, { color: colors.textSecondary }]}>Checking availability…</Text>
        )}
        {status === 'available' && (
          <Text style={[styles.hint, { color: colors.success }]}>✓ @{username} is available</Text>
        )}
        {status === 'taken' && (
          <Text style={[styles.hint, { color: colors.danger }]}>@{username} is taken — try another</Text>
        )}
        {status === 'invalid' && (
          <Text style={[styles.hint, { color: colors.textTertiary }]}>3–20 characters: letters, numbers, or _</Text>
        )}

        {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}

        <Button full size="lg" loading={loading} onPress={onSubmit} style={styles.submit}>
          Continue
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  title: { fontSize: 26, fontFamily: fonts.bold, marginTop: spacing.lg },
  subtitle: { fontSize: 14.5, fontFamily: fonts.regular, lineHeight: 21, marginBottom: spacing.md },
  label: { fontSize: 13, fontFamily: fonts.medium, marginTop: spacing.sm },
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
  hint: { fontSize: 12.5, fontFamily: fonts.medium },
  error: { fontSize: 13.5, fontFamily: fonts.medium, marginTop: spacing.xs },
  submit: { marginTop: spacing.lg },
});
