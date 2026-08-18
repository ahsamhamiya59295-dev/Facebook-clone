import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'fb_theme';
const PREF_KEY = 'fb_theme_pref';

function readInitialTheme() {
  // Light is the default. A stored theme is only trusted once the user has
  // explicitly toggled it (PREF_KEY), so previous auto-saved defaults reset.
  if (typeof window === 'undefined') return 'light';
  try {
    if (window.localStorage.getItem(PREF_KEY) === '1') {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') return stored;
    }
  } catch (err) {
    // localStorage may be blocked — fall through
  }
  return 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readInitialTheme);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.theme = theme;
    try {
      if (window.localStorage.getItem(PREF_KEY) === '1') {
        window.localStorage.setItem(STORAGE_KEY, theme);
      }
    } catch (err) {
      // ignore quota / private-mode failures
    }
  }, [theme]);

  const setTheme = useCallback((next) => {
    if (next !== 'light' && next !== 'dark') return;
    setThemeState(next);
    try {
      window.localStorage.setItem(PREF_KEY, '1');
    } catch (err) {
      // ignore quota / private-mode failures
    }
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
    try {
      window.localStorage.setItem(PREF_KEY, '1');
    } catch (err) {
      // ignore quota / private-mode failures
    }
  }, []);

  const value = { theme, setTheme, toggle };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export default ThemeContext;
