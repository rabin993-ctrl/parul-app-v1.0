import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/fonts';
import { radius, spacing } from '../../theme/tokens';
import { AppLogo } from '../../components/ui/AppLogo';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/icons/Icon';
import { useAuth } from '../../context/AuthContext';

export function AuthConfirmSuccessScreen() {
  const { colors } = useTheme();
  const { clearAuthConfirm } = useAuth();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <AppLogo size={72} showWordmark />

      <View style={[styles.badge, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
        <Icon name="paw" size={40} color={colors.primary} />
      </View>

      <Text style={[styles.title, { color: colors.text }]}>You&apos;re verified!</Text>
      <Text style={[styles.message, { color: colors.textSecondary }]}>
        Your account is all set. Sign in to start finding and helping pets on Parul.
      </Text>

      <Button full size="lg" onPress={clearAuthConfirm} style={styles.button}>
        Sign in
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl2,
    gap: spacing.md,
  },
  badge: {
    width: 76,
    height: 76,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  title: { fontSize: 22, fontFamily: fonts.bold, textAlign: 'center', marginTop: spacing.xs },
  message: { fontSize: 15, fontFamily: fonts.regular, textAlign: 'center', lineHeight: 22 },
  button: { alignSelf: 'stretch', marginTop: spacing.md, borderRadius: radius.md },
});
