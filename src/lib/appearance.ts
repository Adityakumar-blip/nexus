export const APP_COLOR_THEMES = [
  {
    value: "slate",
    label: "Slate",
    description: "Neutral graphite with a restrained product feel.",
    swatches: ["#111827", "#475569", "#94a3b8"],
  },
  {
    value: "ocean",
    label: "Ocean",
    description: "Cool blue energy with crisp dashboard contrast.",
    swatches: ["#0f172a", "#0f766e", "#38bdf8"],
  },
  {
    value: "emerald",
    label: "Emerald",
    description: "Clean green accents with a fresh operations tone.",
    swatches: ["#052e16", "#059669", "#6ee7b7"],
  },
  {
    value: "amber",
    label: "Amber",
    description: "Warm gold highlights with a premium workspace edge.",
    swatches: ["#451a03", "#d97706", "#fbbf24"],
  },
  {
    value: "rose",
    label: "Rose",
    description: "Sharp coral-red accents that feel bold but still SaaS-safe.",
    swatches: ["#4c0519", "#e11d48", "#fda4af"],
  },
] as const;

export type AppColorTheme = (typeof APP_COLOR_THEMES)[number]["value"];

export const DEFAULT_COLOR_THEME: AppColorTheme = "slate";
export const APP_COLOR_THEME_STORAGE_KEY = "nexus-color-theme";

const APP_COLOR_THEME_SET = new Set<AppColorTheme>(
  APP_COLOR_THEMES.map((theme) => theme.value),
);

export function isAppColorTheme(value: unknown): value is AppColorTheme {
  return typeof value === "string" && APP_COLOR_THEME_SET.has(value as AppColorTheme);
}

export function normalizeAppColorTheme(value: unknown): AppColorTheme {
  return isAppColorTheme(value) ? value : DEFAULT_COLOR_THEME;
}
