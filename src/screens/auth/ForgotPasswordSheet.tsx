import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/fonts';
import { MOBILE_INPUT_FONT_SIZE, radius, spacing } from '../../theme/tokens';
import { Button } from '../../components/ui/Button';
import { AppTextInput } from '../../components/ui/AppTextInput';
import { Sheet } from '../../components/ui/Sheet';
import { useAuth } from '../../context/AuthContext';
import { useMobileWeb } from '../../hooks/useMobileWeb';
import { mailboxButtonLabel, openMailbox } from '../../utils/openMailbox';

const EMAIL_RE = /\S+@\S+\.\S+/;
const RESEND_COOLDOWN_SECONDS = 30;

export function ForgotPasswordSheet({
  visible,
  initialEmail,
  onClose,
}: {
  visible: boolean;
  initialEmail?: string;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const mobileWeb = useMobileWeb();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState(initialEmail ?? '');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const trimmedEmail = email.trim();
  const openLabel = sent ? mailboxButtonLabel(trimmedEmail) : null;

  useEffect(() => {
    if (!visible) return;
    setEmail(initialEmail ?? '');
    setError(null);
    setInfo(null);
    setLoading(false);
    setResendLoading(false);
    setSent(false);
    setCooldown(0);
  }, [visible, initialEmail]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendResetLink() {
    if (!EMAIL_RE.test(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    setError(null);
    setInfo(null);
    setLoading(true);
    const res = await resetPassword(trimmedEmail);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSent(true);
  }

  async function onResend() {
    if (cooldown > 0 || resendLoading || !EMAIL_RE.test(trimmedEmail)) return;
    setError(null);
    setInfo(null);
    setResendLoading(true);
    const res = await resetPassword(trimmedEmail);
    setResendLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setInfo(`Reset link resent to ${trimmedEmail}.`);
  }

  const footer = sent ? (
    <View style={styles.footerActions}>
      {openLabel ? (
        <Button full size="lg" icon="mail" onPress={() => void openMailbox(trimmedEmail)}>
          {openLabel}
        </Button>
      ) : null}
      <Button
        full
        size="lg"
        variant={openLabel ? 'secondary' : 'primary'}
        loading={resendLoading}
        disabled={cooldown > 0}
        onPress={onResend}
      >
        {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend reset link'}
      </Button>
    </View>
  ) : (
    <Button full size="lg" loading={loading} onPress={() => { void sendResetLink(); }}>
      Send reset link
    </Button>
  );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Forgot password"
      contentKey={sent ? 'sent' : 'form'}
      footer={footer}
      footerSizeEstimate={sent ? (openLabel ? 120 : 72) : undefined}
    >
      <View style={styles.body}>
        {sent ? (
          <>
            <Text style={[styles.message, { color: colors.text }]}>
              Check your inbox
            </Text>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              We sent a password reset link to{' '}
              <Text style={{ color: colors.text, fontFamily: fonts.semibold }}>
                {trimmedEmail}
              </Text>
              . Open the link in that email to choose a new password. It can take a minute to
              arrive — don&apos;t forget to check spam.
            </Text>
            {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
            {info ? <Text style={[styles.info, { color: colors.textSecondary }]}>{info}</Text> : null}
            <Pressable hitSlop={8} onPress={onClose} style={styles.backRow}>
              <Text style={[styles.backText, { color: colors.textSecondary }]}>
                Wrong email?{' '}
                <Text style={[styles.backLink, { color: colors.primary }]}>Go back</Text>
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Enter the email for your account and we&apos;ll send you a link to reset your password.
            </Text>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
              <View
                style={[
                  styles.inputWrap,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <AppTextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@email.com"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoFocus={Platform.OS === 'web' && !mobileWeb}
                  returnKeyType="send"
                  onSubmitEditing={() => { void sendResetLink(); }}
                  style={[styles.input, { color: colors.text }]}
                />
              </View>
            </View>
            {error ? (
              <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
            ) : null}
          </>
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.lg },
  footerActions: { gap: spacing.sm },
  message: { fontSize: 17, fontFamily: fonts.bold },
  hint: { fontSize: 14.5, fontFamily: fonts.regular, lineHeight: 21 },
  info: { fontSize: 13.5, fontFamily: fonts.regular, lineHeight: 20 },
  field: { gap: 6 },
  label: { fontSize: 12.5, fontFamily: fonts.semibold, letterSpacing: 0.2 },
  inputWrap: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  input: {
    fontSize: MOBILE_INPUT_FONT_SIZE,
    fontFamily: fonts.regular,
    paddingVertical: 13,
  },
  error: { fontSize: 13.5, fontFamily: fonts.medium, marginTop: -spacing.xs },
  backRow: { marginTop: -spacing.xs },
  backText: { fontSize: 14, fontFamily: fonts.regular, textAlign: 'center' },
  backLink: { fontFamily: fonts.semibold },
});
