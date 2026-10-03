"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Theme } from "@/types/workflow";

export const THEME_STORAGE_KEY = "flowforge.theme";
const DEFAULT_THEME: Theme = "dark";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * The server has no `<html>` class to read, so it always reports the default.
 *
 * This is the whole fix for the hydration mismatch: `useSyncExternalStore` renders
 * the server snapshot during hydration and switches to the real value afterwards,
 * which React treats as a store update rather than a mismatch. Reading `document`
 * inside a `useState` initializer — the previous implementation — made the server
 * tree and the first client tree genuinely different for anyone who had picked the
 * light theme, producing a console warning and a wrong icon on first paint.
 */
function getServerSnapshot(): Theme {
  return DEFAULT_THEME;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function writeTheme(theme: Theme): void {
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private browsing or a full quota: the toggle still works for this session.
  }
  for (const listener of listeners) listener();
}

/**
 * Theme state lives in React (not Zustand) because it must run before first paint
 * to avoid a flash; `app/layout.tsx` sets the class from an inline script and this
 * provider simply adopts whatever is already on <html>.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((next: Theme) => writeTheme(next), []);
  const toggleTheme = useCallback(
    () => writeTheme(getSnapshot() === "dark" ? "light" : "dark"),
    [],
  );

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return context;
}

/**
 * Adopt a theme that came from persisted workflow settings, but only if this
 * browser has never expressed a preference of its own.
 *
 * `settings.theme` travels inside the exported/imported workflow JSON, so it is
 * the only channel by which a file can carry a theme. Without this it was
 * written on every autosave and never read back — and importing a light-theme
 * workflow into a dark browser silently did nothing.
 */
export function adoptThemeIfUnset(theme: Theme): void {
  try {
    if (localStorage.getItem(THEME_STORAGE_KEY) !== null) return;
  } catch {
    return;
  }
  writeTheme(theme);
}

/** Inline bootstrap that sets the theme class before first paint. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t!=='dark'&&t!=='light'){t=${JSON.stringify(DEFAULT_THEME)}}var r=document.documentElement;r.classList.toggle('dark',t==='dark');r.style.colorScheme=t}catch(e){document.documentElement.classList.add('dark')}})();`;
