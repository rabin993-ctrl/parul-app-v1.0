import React, { useMemo } from 'react';
import { Text, Platform, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useMentionRegistry } from '../../hooks/useMentionRegistry';
import { useMentionNavigation } from '../../hooks/useMentionNavigation';
import { useAppLinkNavigation } from '../../hooks/useAppLinkNavigation';
import { segmentRichText, type MentionTarget } from '../../utils/mentionText';
import type { PawCircle } from '../../data/pawCircles';

type MentionTextProps = TextProps & {
  children: string;
  mentionStyle?: TextStyle;
  linkStyle?: TextStyle;
  onMentionPress?: (target: MentionTarget) => void;
  onLinkPress?: (url: string) => void;
  extraCircles?: PawCircle[];
  returnTo?: 'Feed' | 'Hub' | 'Messages' | 'Profile';
};

const URL_HINT = /https?:\/\//i;

export function MentionText({
  children: text,
  style,
  mentionStyle,
  linkStyle,
  onMentionPress,
  onLinkPress,
  extraCircles,
  returnTo,
  ...rest
}: MentionTextProps) {
  const { colors } = useTheme();
  const registry = useMentionRegistry(extraCircles);
  const defaultNavigate = useMentionNavigation({ returnTo });
  const defaultLinkNavigate = useAppLinkNavigation({ returnTo });
  const handleMentionPress = onMentionPress ?? defaultNavigate;
  const handleLinkPress = onLinkPress ?? defaultLinkNavigate;

  const segments = useMemo(
    () => segmentRichText(text, registry),
    [text, registry],
  );

  const mentionBaseStyle = useMemo<TextStyle>(() => ({
    color: colors.primary,
    fontWeight: '600',
    ...mentionStyle,
  }), [colors.primary, mentionStyle]);

  const linkBaseStyle = useMemo<TextStyle>(() => ({
    color: colors.primary,
    textDecorationLine: 'underline',
    ...Platform.select({
      web: { cursor: 'pointer' as const },
      default: {},
    }),
    ...linkStyle,
  }), [colors.primary, linkStyle]);

  const hasRichContent = text.includes('@') || URL_HINT.test(text);
  if (!hasRichContent) {
    return (
      <Text style={style} {...rest}>
        {text}
      </Text>
    );
  }

  return (
    <Text style={style} {...rest}>
      {segments.map((seg, idx) => {
        if (seg.kind === 'text') {
          return seg.value;
        }
        if (seg.kind === 'url') {
          return (
            <Text
              key={`${idx}-${seg.value}`}
              style={linkBaseStyle}
              onPress={() => handleLinkPress(seg.value)}
              accessibilityRole="link"
              accessibilityLabel={seg.value}
              suppressHighlighting={false}
            >
              {seg.value}
            </Text>
          );
        }
        return (
          <Text
            key={`${idx}-${seg.raw}`}
            style={mentionBaseStyle}
            onPress={() => handleMentionPress(seg.target)}
            suppressHighlighting={false}
          >
            {seg.display}
          </Text>
        );
      })}
    </Text>
  );
}
