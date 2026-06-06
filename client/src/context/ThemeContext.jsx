import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";

const ThemeContext = createContext(null);
const storageKey = "codesphere_theme";
const validThemePrefs = new Set(["light", "dark", "system"]);

function getSystemTheme() {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function normalizeThemePref(value) {
  return validThemePrefs.has(value) ? value : "system";
}

function resolveTheme(themePref) {
  if (themePref === "dark") return "dark";
  if (themePref === "light") return "light";
  return getSystemTheme();
}

function applyDocumentTheme(themePref) {
  const resolved = resolveTheme(themePref);
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolved);
  }
  return resolved;
}

export function ThemeProvider({ children }) {
  const { user } = useAuth();
  const [themePref, setThemePref] = useState(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
    return normalizeThemePref(saved || user?.preferences?.theme);
  });
  const [theme, setTheme] = useState(() => applyDocumentTheme(themePref));

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    const userTheme = normalizeThemePref(user?.preferences?.theme);
    if (!saved && user?.preferences?.theme && userTheme !== themePref) {
      setThemePref(userTheme);
    }
  }, [user?.preferences?.theme, themePref]);

  useEffect(() => {
    const normalizedThemePref = normalizeThemePref(themePref);
    if (normalizedThemePref !== themePref) {
      setThemePref(normalizedThemePref);
      return;
    }
    if (typeof window !== "undefined") localStorage.setItem(storageKey, normalizedThemePref);
    const resolved = applyDocumentTheme(normalizedThemePref);
    setTheme(resolved);
  }, [themePref]);

  useEffect(() => {
    if (themePref !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      const resolved = applyDocumentTheme("system");
      setTheme(resolved);
    };
    media.addEventListener ? media.addEventListener("change", listener) : media.addListener(listener);
    listener();
    return () => {
      media.removeEventListener ? media.removeEventListener("change", listener) : media.removeListener(listener);
    };
  }, [themePref]);

  const value = useMemo(() => ({ themePref, theme, setThemePref }), [themePref, theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
