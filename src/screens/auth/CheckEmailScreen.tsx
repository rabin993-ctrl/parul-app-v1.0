import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/fonts';
import { radius, spacing } from '../../theme/tokens';
import { AppLogo } from '../../components/ui/AppLogo';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/icons/Icon';
import { mailboxButtonLabel, openMailbox } from '../../utils/openMailbox';

const RESEND_COOLDOWN_SECONDS = 30;

export function CheckEmailScreen({
  email,
  onResend,
  resendLoading,
  info,
  error,
  onBack,
}: {
  email: string;
  onResend: () => void;
  resendLoading: boolean;
  info?: string | null;
  error?: string | null;
  onBack: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const openLabel = mailboxButtonLabel(email);

  const handleResend = () => {
    if (cooldown > 0 || resendLoading) return;
    setCooldown(RESEND_COOLDOWN_SECONDS);
    onResend();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + spacing.xl2,
            paddingBottom: insets.bottom + spacing.xl2,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AppLogo size={72} showWordmark />

        <View style={[styles.badge, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
          <Icon name="paw" size={40} color={colors.primary} />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>Check your email</Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          We sent a confirmation link to{'\n'}
          <Text style={[styles.email, { color: colors.text }]}>{email}</Text>
        </Text>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Tap the link in that email to activate your account. It can take a minute to arrive — don&apos;t
          forget to check spam.
        </Text>

        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        {info ? <Text style={[styles.info, { color: colors.textSecondary }]}>{info}</Text> : null}

        <View style={styles.actions}>
          {openLabel ? (
            <Button full size="lg" icon="mail" onPress={() => void openMailbox(email)}>
              {openLabel}
            </Button>
          ) : null}

          <Button
            full
            size="lg"
            variant="secondary"
            loading={resendLoading}
            disabled={cooldown > 0}
            onPress={handleResend}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend confirmation email'}
          </Button>
        </View>

        <Pressable hitSlop={8} onPress={onBack} style={styles.backRow}>
          <Text style={[styles.backText, { color: colors.textSecondary }]}>
            Wrong email?{' '}
            <Text style={[styles.backLink, { color: colors.primary }]}>Go back</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl2,
    gap: spacing.md,
  },
  badge: {
    width: 76,
    height: 76,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  title: { fontSize: 22, fontFamily: fonts.bold, textAlign: 'center', marginTop: spacing.xs },
  message: { fontSize: 15, fontFamily: fonts.regular, textAlign: 'center', lineHeight: 22 },
  email: { fontFamily: fonts.semibold },
  hint: { fontSize: 13.5, fontFamily: fonts.regular, textAlign: 'center', lineHeight: 20 },
  error: { fontSize: 13.5, fontFamily: fonts.medium, textAlign: 'center' },
  info: { fontSize: 13.5, fontFamily: fonts.regular, textAlign: 'center', lineHeight: 20 },
  actions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.sm },
  backRow: { marginTop: spacing.md },
  backText: { fontSize: 14, fontFamily: fonts.regular, textAlign: 'center' },
  backLink: { fontFamily: fonts.semibold },
});
