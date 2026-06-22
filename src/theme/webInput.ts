import { Platform, StyleSheet, type TextInputProps, type TextStyle } from 'react-native';
import { MOBILE_INPUT_FONT_SIZE } from './tokens';

/** Suppress browser default focus ring on RN Web text inputs */
export const webNoOutline = Platform.select({
  web: { outlineStyle: 'none', outlineWidth: 0 } as object,
  default: {},
});

/** Ensure sheet / scroll-view inputs receive taps on RN Web */
export const webInputTouch = Platform.select({
  web: { touchAction: 'auto', cursor: 'text' } as object,
  default: {},
});

export const webFieldInputStyle = Platform.select({
  web: {
    outlineStyle: 'none',
    outlineWidth: 0,
    touchAction: 'auto',
    cursor: 'text',
    fontSize: MOBILE_INPUT_FONT_SIZE,
    userSelect: 'text',
    WebkitUserSelect: 'text',
  } as object,
  default: {},
});

/** Shared RN-web styles so inputs stay tappable/editable on mobile Safari. */
export const webTextInputStyle = Platform.select({
  web: {
    fontSize: MOBILE_INPUT_FONT_SIZE,
    userSelect: 'text',
    WebkitUserSelect: 'text',
    touchAction: 'manipulation',
    outlineStyle: 'none',
    outlineWidth: 0,
  } as object,
  default: {},
});

type WebInputEvent = {
  stopPropagation?: () => void;
  nativeEvent?: { stopPropagation?: () => void };
};

/** Props merged onto TextInput instances inside sheets, scroll views, and forms. */
export function webTextInputProps(extra?: TextInputProps): TextInputProps {
  if (Platform.OS !== 'web') return extra ?? {};

  const stopTouchBubble = (e: WebInputEvent) => {
    e.stopPropagation?.();
    e.nativeEvent?.stopPropagation?.();
  };

  const merged: TextInputProps & {
    onMouseDown?: (e: WebInputEvent) => void;
  } = {
    ...extra,
    style: StyleSheet.flatten([webTextInputStyle, webFieldInputStyle, extra?.style]),
    showSoftInputOnFocus: extra?.showSoftInputOnFocus ?? true,
    onTouchStart: (e) => {
      stopTouchBubble(e as WebInputEvent);
      extra?.onTouchStart?.(e);
    },
    onMouseDown: (e) => {
      stopTouchBubble(e);
      (extra as { onMouseDown?: (ev: WebInputEvent) => void })?.onMouseDown?.(e);
    },
  };

  return merged;
}
