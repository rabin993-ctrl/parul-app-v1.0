import { Platform, type PressableProps } from 'react-native';

/** data-set hook for WebInputFocusFix — stops sheet scroll from swallowing author taps. */
export const AUTHOR_PROFILE_LINK_DATASET = { authorProfileLink: 'true' } as const;

type AuthorPressableProps = Pick<
  PressableProps,
  'onPress' | 'disabled' | 'hitSlop' | 'accessibilityRole' | 'accessibilityLabel'
> & {
  dataSet?: Record<string, string>;
  style?: PressableProps['style'];
};

export function authorProfilePressableProps(
  onPress: (() => void) | undefined,
  label: string,
): AuthorPressableProps {
  if (!onPress) {
    return { disabled: true };
  }

  return {
    onPress,
    hitSlop: 6,
    accessibilityRole: 'button',
    accessibilityLabel: label,
    ...(Platform.OS === 'web'
      ? {
          dataSet: AUTHOR_PROFILE_LINK_DATASET,
          style: ({ pressed }: { pressed: boolean }) => [
            {
              cursor: 'pointer',
              touchAction: 'manipulation',
              userSelect: 'none',
              WebkitUserSelect: 'none',
            } as object,
            pressed ? { opacity: 0.7 } : null,
          ],
        }
      : {
          style: ({ pressed }: { pressed: boolean }) => (pressed ? { opacity: 0.7 } : undefined),
        }),
  };
}
