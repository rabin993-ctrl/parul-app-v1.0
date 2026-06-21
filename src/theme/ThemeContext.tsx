import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  lightColors,
  darkColors,
  lightGradients,
  darkGradients,
  modalScrim,
} from './tokens';
import {
  adaptGroupedListBg,
  adaptIconBg,
  adaptModalScrim,
  getPostTagStyle,
  type ThemeMode,
} from './adaptColor';
import type { PostTag } from '../data/mockData';

type Colors = typeof lightColors;

/** What the user chose: an explicit mode, or "follow the system". */
export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  /** Effective, resolved mode actually used for rendering ('light' | 'dark'). */
  mode: ThemeMode;
  /** The user's stored preference (may be 'system'). */
  preference: ThemePreference;
  colors: Colors;
  gradients: typeof lightGradients | typeof darkGradients;
  scrim: string;
  isDark: boolean;
  /** Flip between light/dark (sets an explicit preference). */
  toggleTheme: () => void;
  /** Set an explicit mode. */
  setMode: (mode: ThemeMode) => void;
  /** Set any preference, including 'system' (follow the OS). */
  setPreference: (pref: ThemePreference) => void;
  iconBg: (lightBg: string) => string;
  groupedBg: string;
  postTag: (tag: PostTag) => { label: string; bg: string; text: string };
}

const STORAGE_KEY = '@parul/theme-mode';

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  preference: 'dark',
  colors: darkColors,
  gradients: darkGradients,
  scrim: modalScrim.dark,
  isDark: true,
  toggleTheme: () => {},
  setMode: () => {},
  setPreference: () => {},
  iconBg: (light) => light,
  groupedBg: adaptGroupedListBg('dark'),
  postTag: (tag) => getPostTagStyle(tag, 'dark'),
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Live OS color scheme (works on iOS, Android, and web via react-native-web).
  const systemScheme = useColorScheme();
  // Dark is the app's default theme. Users can switch to Light or System from
  // Profile → Settings → Theme; that explicit choice is persisted and restored
  // below, overriding this default.
  const [preference, setPreferenceState] = useState<ThemePreference>('dark');

  // Restore the saved preference once on mount. New installs default to 'dark'.
  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then(stored => {
        if (!mounted) return;
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setPreferenceState(stored);
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const setMode = useCallback((next: ThemeMode) => setPreference(next), [setPreference]);

  // Resolve the effective mode: follow the OS when preference is 'system'.
  const mode: ThemeMode =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const toggleTheme = useCallback(() => {
    setPreference(mode === 'light' ? 'dark' : 'light');
  }, [mode, setPreference]);

  const colors = mode === 'light' ? lightColors : darkColors;
  const gradients = mode === 'light' ? lightGradients : darkGradients;
  const scrim = adaptModalScrim(mode);

  const value = useMemo<ThemeContextValue>(() => ({
    mode,
    preference,
    colors,
    gradients,
    scrim,
    isDark: mode === 'dark',
    toggleTheme,
    setMode,
    setPreference,
    iconBg: (lightBg: string) => adaptIconBg(lightBg, mode),
    groupedBg: adaptGroupedListBg(mode),
    postTag: (tag: PostTag) => getPostTagStyle(tag, mode),
  }), [mode, preference, colors, gradients, scrim, toggleTheme, setMode, setPreference]);

  return (
    <ThemeContext.Provider value={value}>
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export function useTheme() {
  return useContext(ThemeContext);
}
