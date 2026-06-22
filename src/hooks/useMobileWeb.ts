import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/** Synchronously detect a narrow/coarse-pointer mobile browser. */
function detectMobileWeb(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const width = window.visualViewport?.width ?? window.innerWidth;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return width < 768 || coarse;
}

/** True on narrow/coarse-pointer mobile browsers (not desktop web). */
export function useMobileWeb(): boolean {
  // Lazy init so the value is correct on the *first* render. Starting at `false`
  // made every `autoFocus={!mobileWeb}` render as autoFocus on mount, which on
  // iOS Safari fires a phantom focus that makes the real tap drop the keyboard.
  const [mobileWeb, setMobileWeb] = useState(detectMobileWeb);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const check = () => setMobileWeb(detectMobileWeb());

    check();
    window.visualViewport?.addEventListener('resize', check);
    window.addEventListener('resize', check);
    const coarseQuery = window.matchMedia?.('(pointer: coarse)');
    coarseQuery?.addEventListener?.('change', check);

    return () => {
      window.visualViewport?.removeEventListener('resize', check);
      window.removeEventListener('resize', check);
      coarseQuery?.removeEventListener?.('change', check);
    };
  }, []);

  return mobileWeb;
}
