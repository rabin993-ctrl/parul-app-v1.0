import React from 'react';
import { View, Text, Pressable, StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { AdoptionUserFlag } from './AdoptionUserFlag';
import type { AdoptionTrustFlag } from '../../utils/adoptionUserFlag';
import { authorProfilePressableProps } from '../../utils/authorProfilePress';

export function UserNameWithAdoptionFlag({
  userId,
  name,
  flag,
  onPress,
  nameStyle,
  style,
  numberOfLines = 1,
}: {
  userId: string;
  name: string;
  flag?: AdoptionTrustFlag | null;
  onPress?: () => void;
  nameStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
  numberOfLines?: number;
}) {
  const { colors } = useTheme();
  const content = (
    <View style={[styles.row, style]}>
      <Text
        style={[styles.name, { color: colors.text }, nameStyle]}
        numberOfLines={numberOfLines}
        ellipsizeMode="tail"
      >
        {name}
      </Text>
      <AdoptionUserFlag userId={userId} flag={flag} />
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      {...authorProfilePressableProps(onPress, `View ${name}'s profile`)}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
    flexShrink: 1,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  name: {
    fontSize: 15.5,
    lineHeight: 20,
    fontWeight: '700',
    flexShrink: 1,
    minWidth: 0,
  },
});
