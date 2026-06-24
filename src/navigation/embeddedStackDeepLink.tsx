import { useLayoutEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NavigatorScreenParams, ParamListBase } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

/**
 * Hub screens (AdoptionHub, RescueHub) are leaf routes on the feed stack but
 * embed their own stack navigators. Nested navigate targets like
 * `{ screen: 'Detail', params: … }` must be forwarded into the inner stack —
 * otherwise React Navigation stores invalid state and the hub can render blank.
 */
export function EmbeddedStackDeepLinkBridge<P extends ParamListBase>({
  deepLink,
  onHandled,
}: {
  deepLink?: NavigatorScreenParams<P>;
  onHandled?: () => void;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<P>>();
  const handledKeyRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!deepLink?.screen) {
      handledKeyRef.current = null;
      return;
    }

    const screen = String(deepLink.screen);
    const key = `${screen}:${JSON.stringify(deepLink.params ?? null)}`;
    if (handledKeyRef.current === key) return;
    handledKeyRef.current = key;

    (navigation.navigate as unknown as (screen: string, params?: object) => void)(
      screen,
      deepLink.params as object | undefined,
    );

    // Clear hub params after the inner navigate commits — clearing synchronously
    // can leave AdoptionHub with invalid nested state (blank screen on web).
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) onHandled?.();
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [deepLink, navigation, onHandled]);

  return null;
}
