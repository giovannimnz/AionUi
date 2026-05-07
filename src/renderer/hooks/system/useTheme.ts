// hooks/useTheme.ts
import { ConfigStorage } from '@/common/config/storage';
import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const DEFAULT_THEME: Theme = 'light';
const THEME_CACHE_KEY = '__aionui_theme';

/**
 * In remote mode, the server injects the theme into the HTML before sending.
 * Read it directly from the DOM to avoid localStorage round-trips.
 */
function getServerInjectedTheme(): Theme {
  const theme = document.documentElement.getAttribute('data-theme') as Theme | null;
  return theme === 'light' || theme === 'dark' ? theme : null;
}

/**
 * Persist theme to server-side storage (for remote/WebUI mode).
 * Falls back silently if the server is unreachable.
 */
async function persistThemeToServer(theme: Theme): Promise<void> {
  try {
    const response = await fetch('/api/user-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme }),
    });
    if (!response.ok) {
      console.warn('[useTheme] Server persist failed:', response.status);
    }
  } catch (error) {
    // Silent failure — local state is already updated
    console.warn('[useTheme] Server persist error:', error);
  }
}

// Initialize theme immediately when module loads
const initTheme = async () => {
  try {
    // Priority: server-injected theme (remote mode) > ConfigStorage (desktop mode) > default
    const serverTheme = getServerInjectedTheme();
    const theme = serverTheme ?? ((await ConfigStorage.get('theme')) as Theme | null) ?? DEFAULT_THEME;
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('arco-theme', theme);
    try {
      localStorage.setItem(THEME_CACHE_KEY, theme);
    } catch (_e) {
      /* noop */
    }
    return theme;
  } catch (error) {
    console.error('Failed to load initial theme:', error);
    document.documentElement.setAttribute('data-theme', DEFAULT_THEME);
    document.body.setAttribute('arco-theme', DEFAULT_THEME);
    return DEFAULT_THEME;
  }
};

// Run theme initialization immediately
let initialThemePromise: Promise<Theme> | null = null;
if (typeof window !== 'undefined') {
  initialThemePromise = initTheme();
}

const useTheme = (): [Theme, (theme: Theme) => Promise<void>] => {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  // Apply theme to document
  const applyTheme = useCallback((newTheme: Theme) => {
    document.documentElement.setAttribute('data-theme', newTheme);
    document.body.setAttribute('arco-theme', newTheme);
    try {
      localStorage.setItem(THEME_CACHE_KEY, newTheme);
    } catch (_e) {
      /* noop */
    }
  }, []);

  // Set theme with persistence
  const setTheme = useCallback(
    async (newTheme: Theme) => {
      try {
        setThemeState(newTheme);
        applyTheme(newTheme);
        // Persist to both local (desktop) and server (remote mode)
        await ConfigStorage.set('theme', newTheme);
        persistThemeToServer(newTheme);
      } catch (error) {
        console.error('Failed to save theme:', error);
        // Revert on error
        setThemeState(theme);
        applyTheme(theme);
      }
    },
    [theme, applyTheme]
  );

  // Initialize theme state from the early initialization
  useEffect(() => {
    if (initialThemePromise) {
      initialThemePromise
        .then((initialTheme) => {
          setThemeState(initialTheme);
        })
        .catch((error) => {
          console.error('Failed to initialize theme:', error);
        });
    }
  }, []);

  return [theme, setTheme];
};

export default useTheme;
