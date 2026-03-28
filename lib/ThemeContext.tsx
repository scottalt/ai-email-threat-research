'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getThemeById, type ThemeDef } from './themes';

interface ThemeContextValue {
  theme: ThemeDef;
  setThemeId: (id: string) => void;
  loadFromServer: (themeId: string) => void;
  resetToDefault: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: getThemeById('phosphor'),
  setThemeId: () => {},
  loadFromServer: () => {},
  resetToDefault: () => {},
});

function applyThemeVars(theme: ThemeDef) {
  const root = document.documentElement;
  const c = theme.colors;
  root.style.setProperty('--c-primary', c.primary);
  root.style.setProperty('--c-secondary', c.secondary);
  root.style.setProperty('--c-muted', c.muted);
  root.style.setProperty('--c-dark', c.dark);
  root.style.setProperty('--c-bg', c.bg);
  root.style.setProperty('--c-bg-alt', c.bgAlt);
  root.style.setProperty('--c-accent', c.accent);
  root.style.setProperty('--c-accent-dim', c.accentDim);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeDef>(getThemeById('phosphor'));
  const [serverLoaded, setServerLoaded] = useState(false);

  // On mount: load from localStorage as initial fast paint
  useEffect(() => {
    try {
      const saved = localStorage.getItem('terminal_theme');
      if (saved) {
        const t = getThemeById(saved);
        setTheme(t);
        applyThemeVars(t);
      }
    } catch {}
  }, []);

  // Called by PlayerContext when profile loads — server theme takes priority
  const loadFromServer = useCallback((themeId: string) => {
    if (serverLoaded) return; // only apply once per session
    const t = getThemeById(themeId);
    setTheme(t);
    applyThemeVars(t);
    try { localStorage.setItem('terminal_theme', themeId); } catch {}
    setServerLoaded(true);
  }, [serverLoaded]);

  // Set theme locally + save to server
  const setThemeId = useCallback((id: string) => {
    const t = getThemeById(id);
    setTheme(t);
    applyThemeVars(t);
    try { localStorage.setItem('terminal_theme', id); } catch {}
    // Fire-and-forget save to server
    fetch('/api/player/theme', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ themeId: id }),
    }).catch(() => {}); // non-critical — localStorage is the fallback
  }, []);

  const resetToDefault = useCallback(() => {
    const t = getThemeById('phosphor');
    setTheme(t);
    applyThemeVars(t);
    setServerLoaded(false);
    try { localStorage.removeItem('terminal_theme'); } catch {}
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setThemeId, loadFromServer, resetToDefault }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
