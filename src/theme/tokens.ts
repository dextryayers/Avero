export const AVERO_BRAND = {
  name: "AVERO STUDIO",
  tagline: "Professional Photo Studio",
  version: "v2.0.0",
  logo: "/logo.png",
} as const;

// Palet netral profesional. Satu aksen solid, tanpa gradien, tanpa glow.
export const tokens = {
  color: {
    bgApp: "#161618",
    bgPanel: "#1c1c1f",
    bgPanelAlt: "#232327",
    bgCanvas: "#101012",
    border: "#2c2c31",
    borderSoft: "#242428",
    textPrimary: "#ececee",
    textSecondary: "#a7a7b0",
    textMuted: "#6e6e78",
    accent: "#2f7cf6",
    accentHover: "#3b8bff",
    accentActive: "#2568d8",
    danger: "#e5534b",
    ok: "#2f7cf6",
    warn: "#d9a441",
  },
  layout: {
    titleBarH: 44,
    menuBarH: 32,
    toolBarW: 56,
    rightPanelW: 300,
    statusBarH: 28,
  },
  radius: {
    sm: 4,
    md: 6,
    lg: 8,
  },
  font: {
    ui: "Inter, system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
  },
} as const;

export type ThemeMode = "dark" | "light";
