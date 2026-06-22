import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { fonts } from '../../theme/fonts';
import { radius, spacing } from '../../theme/tokens';
import { AppLogo } from '../../components/ui/AppLogo';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/icons/Icon';
import { useAuth } from '../../context/AuthContext';

export function AuthConfirmSuccessScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { clearAuthConfirm } = useAuth();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bg,
          paddingTop: insets.top + spacing.xl2,
          paddingBottom: insets.bottom + spacing.xl2,
        },
      ]}
    >
      <AppLogo size={56} showWordmark />

      <View style={[styles.badge, { backgroundColor: colors.surface, borderColor: colors.success }]}>
        <Icon name="check" size={38} color={colors.success} />
      </View>

      <Text style={[styles.title, { color: colors.text }]}>Email verified 🎉</Text>
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
    borderRadius: 38,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  title: { fontSize: 22, fontFamily: fonts.bold, textAlign: 'center', marginTop: spacing.xs },
  message: { fontSize: 15, fontFamily: fonts.regular, textAlign: 'center', lineHeight: 22 },
  button: { alignSelf: 'stretch', marginTop: spacing.md, borderRadius: radius.md },
});
