"use client";

import * as React from "react";
import {
  ThemeProvider as NextThemesProvider,
  useTheme,
} from "next-themes";
import { useAuth } from "@/lib/auth-context";
import {
  APP_COLOR_THEME_STORAGE_KEY,
  DEFAULT_COLOR_THEME,
  type AppColorTheme,
  normalizeAppColorTheme,
} from "@/lib/appearance";
import {
  updateUserAppearanceTheme,
  watchUserProfile,
} from "@/lib/store";

type ThemeOrigin = { x: number; y: number };

type ThemeSwitchContextValue = {
  isDark: boolean;
  toggleTheme: (origin?: ThemeOrigin) => void;
  colorTheme: AppColorTheme;
  setColorTheme: (theme: AppColorTheme) => void;
};

const ThemeSwitchContext = React.createContext<ThemeSwitchContextValue | null>(
  null,
);

function maxRadiusFromPoint(x: number, y: number): number {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
}

function applyColorTheme(theme: AppColorTheme) {
  document.documentElement.dataset.colorTheme = theme;
  window.localStorage.setItem(APP_COLOR_THEME_STORAGE_KEY, theme);
}

function ThemeController({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [colorThemeState, setColorThemeState] = React.useState<AppColorTheme>(() => {
    if (typeof document === "undefined") return DEFAULT_COLOR_THEME;
    return normalizeAppColorTheme(document.documentElement.dataset.colorTheme);
  });
  const isDarkRef = React.useRef(isDark);
  const toggleRef = React.useRef<(origin?: ThemeOrigin) => void>(() => {});

  React.useEffect(() => {
    isDarkRef.current = isDark;
  }, [isDark]);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    applyColorTheme(colorThemeState);
  }, [colorThemeState]);

  React.useEffect(() => {
    if (!user) return;
    return watchUserProfile(user.uid, (profile) => {
      const nextTheme = profile?.appearanceTheme ?? null;
      if (!nextTheme || nextTheme === colorThemeState) return;
      setColorThemeState(nextTheme);
    });
  }, [user, colorThemeState]);

  const toggleTheme = React.useCallback(
    (origin?: ThemeOrigin) => {
      const nextTheme = isDarkRef.current ? "light" : "dark";
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (!document.startViewTransition || reduceMotion) {
        setTheme(nextTheme);
        return;
      }

      const x = origin?.x ?? window.innerWidth / 2;
      const y = origin?.y ?? window.innerHeight / 2;
      const endRadius = maxRadiusFromPoint(x, y);
      const root = document.documentElement;
      root.style.setProperty("--theme-switch-x", `${x}px`);
      root.style.setProperty("--theme-switch-y", `${y}px`);

      const transition = document.startViewTransition(() => {
        setTheme(nextTheme);
      });

      transition.ready
        .then(() => {
          root.animate(
            {
              clipPath: [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${endRadius}px at ${x}px ${y}px)`,
              ],
            },
            {
              duration: 550,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
              pseudoElement: "::view-transition-new(root)",
            } as KeyframeAnimationOptions,
          );
        })
        .catch(() => {
          setTheme(nextTheme);
        });
    },
    [setTheme],
  );

  React.useEffect(() => {
    toggleRef.current = toggleTheme;
  }, [toggleTheme]);

  const setColorTheme = React.useCallback(
    (theme: AppColorTheme) => {
      setColorThemeState(theme);
      if (user) {
        void updateUserAppearanceTheme(user.uid, theme);
      }
    },
    [user],
  );

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat) return;
      const key = e.key.toLowerCase();
      const matchesCtrlAltL = e.ctrlKey && e.altKey && key === "l";
      const matchesAltShiftL = e.altKey && e.shiftKey && key === "l";
      if (!matchesCtrlAltL && !matchesAltShiftL) return;
      e.preventDefault();
      toggleRef.current();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = React.useMemo(
    () => ({ isDark, toggleTheme, colorTheme: colorThemeState, setColorTheme }),
    [isDark, toggleTheme, colorThemeState, setColorTheme],
  );

  return (
    <ThemeSwitchContext.Provider value={value}>
      {children}
    </ThemeSwitchContext.Provider>
  );
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      <ThemeController>{children}</ThemeController>
    </NextThemesProvider>
  );
}

export function useThemeSwitch() {
  const ctx = React.useContext(ThemeSwitchContext);
  if (!ctx) {
    throw new Error("useThemeSwitch must be used within ThemeProvider");
  }
  return ctx;
}
