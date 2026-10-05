"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "orvan.theme";

/**
 * Runs before first paint, inlined in <head>. Without it the page would mount
 * in dark, then flip to light on hydration — a visible flash on every load for
 * anyone who chose light.
 *
 * Kept as a string on purpose: it has to be a plain script tag, not a module.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)});if(!t)t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme="dark";}})()`;

interface ThemeContext {
  theme: Theme;
  toggle: () => void;
}

const Ctx = createContext<ThemeContext | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // The real value is already on <html>; this only mirrors it into React.
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const attr = document.documentElement.dataset.theme;
    if (attr === "light" || attr === "dark") setTheme(attr);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Private mode: the theme still applies for this session.
      }
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      title={dark ? "Switch to light" : "Switch to dark"}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className={`grid place-items-center rounded-2xl border border-line bg-surface text-ink-dim transition-colors hover:border-accent/40 hover:text-ink ${className}`}
    >
      <svg viewBox="0 0 20 20" className="size-[18px]" aria-hidden="true">
        {dark ? (
          <path
            d="M15.5 11.4A6 6 0 0 1 8.6 4.5a6 6 0 1 0 6.9 6.9Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        ) : (
          <>
            <circle cx="10" cy="10" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M10 2.5v1.8M10 15.7v1.8M17.5 10h-1.8M4.3 10H2.5M15.3 4.7l-1.3 1.3M6 14l-1.3 1.3M15.3 15.3 14 14M6 6 4.7 4.7"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
    </button>
  );
}
