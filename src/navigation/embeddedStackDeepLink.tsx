import { useEffect } from 'react';
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

  useEffect(() => {
    if (!deepLink?.screen) return;
    (navigation.navigate as unknown as (screen: string, params?: object) => void)(
      deepLink.screen as string,
      deepLink.params as object | undefined,
    );
    onHandled?.();
  }, [deepLink, navigation, onHandled]);

  return null;
}
