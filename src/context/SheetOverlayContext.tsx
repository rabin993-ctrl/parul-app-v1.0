import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { BackHandler, Platform } from 'react-native';

type SheetOverlayContextValue = {
  openCount: number;
  registerOpen: () => void;
  registerClose: () => void;
  registerDismissable: (onDismiss: () => void) => () => void;
};

const SheetOverlayContext = createContext<SheetOverlayContextValue | null>(null);

type DismissableOverlay = {
  id: number;
  onDismiss: () => void;
};

const OVERLAY_HISTORY_KEY = '__parulOverlayId';

function getWebOverlayHistoryId(): number | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const state = window.history.state;
  if (!state || typeof state !== 'object') return null;
  const id = (state as Record<string, unknown>)[OVERLAY_HISTORY_KEY];
  return typeof id === 'number' ? id : null;
}

export function SheetOverlayProvider({ children }: { children: React.ReactNode }) {
  const nextIdRef = useRef(1);
  const dismissableRef = useRef<DismissableOverlay[]>([]);
  const suppressNextWebPopRef = useRef(false);
  const [legacyOpenCount, setLegacyOpenCount] = useState(0);
  const [dismissableCount, setDismissableCount] = useState(0);

  const registerOpen = useCallback(() => {
    setLegacyOpenCount(c => c + 1);
  }, []);

  const registerClose = useCallback(() => {
    setLegacyOpenCount(c => Math.max(0, c - 1));
  }, []);

  const dismissTop = useCallback(() => {
    const top = dismissableRef.current[dismissableRef.current.length - 1];
    if (!top) return false;
    top.onDismiss();
    return true;
  }, []);

  const registerDismissable = useCallback((onDismiss: () => void) => {
    const id = nextIdRef.current++;
    dismissableRef.current = [...dismissableRef.current, { id, onDismiss }];
    setDismissableCount(dismissableRef.current.length);

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const currentState = window.history.state;
      const baseState = currentState && typeof currentState === 'object'
        ? currentState as Record<string, unknown>
        : {};
      window.history.pushState({ ...baseState, [OVERLAY_HISTORY_KEY]: id }, '', window.location.href);
    }

    return () => {
      dismissableRef.current = dismissableRef.current.filter(entry => entry.id !== id);
      setDismissableCount(dismissableRef.current.length);

      if (Platform.OS !== 'web' || typeof window === 'undefined') return;
      if (getWebOverlayHistoryId() !== id) return;
      suppressNextWebPopRef.current = true;
      window.history.back();
    };
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => dismissTop());
    return () => subscription.remove();
  }, [dismissTop]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const handlePopState = () => {
      if (suppressNextWebPopRef.current) {
        suppressNextWebPopRef.current = false;
        return;
      }
      dismissTop();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [dismissTop]);

  const openCount = legacyOpenCount + dismissableCount;

  const value = useMemo(
    () => ({ openCount, registerOpen, registerClose, registerDismissable }),
    [openCount, registerOpen, registerClose, registerDismissable],
  );

  return (
    <SheetOverlayContext.Provider value={value}>
      {children}
    </SheetOverlayContext.Provider>
  );
}

export function useSheetOverlayOpen(): boolean {
  const ctx = useContext(SheetOverlayContext);
  return (ctx?.openCount ?? 0) > 0;
}

export function useSheetOverlay() {
  const ctx = useContext(SheetOverlayContext);
  if (!ctx) {
    throw new Error('useSheetOverlay must be used within SheetOverlayProvider');
  }
  return ctx;
}

export function useDismissableOverlay(active: boolean, onDismiss?: () => void) {
  const ctx = useContext(SheetOverlayContext);
  const registerDismissable = ctx?.registerDismissable;
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (!registerDismissable || !active || !onDismiss) return undefined;
    return registerDismissable(() => dismissRef.current?.());
  }, [active, registerDismissable]);
}

/** Hides the glass tab bar while mounted (full-screen chat, sheets, etc.). */
export function useHideTabBarWhileMounted() {
  const { registerOpen, registerClose } = useSheetOverlay();
  useEffect(() => {
    registerOpen();
    return registerClose;
  }, [registerOpen, registerClose]);
}
