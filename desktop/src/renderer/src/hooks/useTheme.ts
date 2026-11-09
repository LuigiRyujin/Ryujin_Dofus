import { useEffect, useState, useCallback } from 'react';
import type { ThemePreference, ResolvedTheme } from '../../../shared/ipc';

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>('dark');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('dark');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const init = async () => {
      try {
        if (window.ryujin) {
          const prefs = await window.ryujin.getPreferences();
          setPreference(prefs.theme);

          if (prefs.theme === 'system') {
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            setResolvedTheme(isDark ? 'dark' : 'light');
            document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
          } else {
            setResolvedTheme(prefs.theme);
            document.documentElement.setAttribute('data-theme', prefs.theme);
          }

          unsubscribe = window.ryujin.onThemeChanged((theme) => {
            setResolvedTheme(theme);
            document.documentElement.setAttribute('data-theme', theme);
          });
        } else {
          // Fallback if not in Electron context
          document.documentElement.setAttribute('data-theme', 'dark');
        }
      } catch (err) {
        console.error('Failed to initialize theme:', err);
      } finally {
        setIsReady(true);
      }
    };

    void init();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const setTheme = useCallback(async (newPref: ThemePreference) => {
    setPreference(newPref);
    try {
      if (window.ryujin) {
        const resolved = await window.ryujin.setTheme(newPref);
        setResolvedTheme(resolved);
        document.documentElement.setAttribute('data-theme', resolved);
      } else {
        const resolved = newPref === 'system'
          ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : newPref;
        setResolvedTheme(resolved);
        document.documentElement.setAttribute('data-theme', resolved);
      }
    } catch (err) {
      console.error('Failed to set theme:', err);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';
    void setTheme(next);
  }, [resolvedTheme, setTheme]);

  return {
    preference,
    resolvedTheme,
    setTheme,
    toggleTheme,
    isReady
  };
}

