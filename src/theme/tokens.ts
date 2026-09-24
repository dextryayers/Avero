export const AVERO_BRAND = {
  name: "AVERO STUDIO",
  tagline: "Professional Photo Studio",
  version: "v2.0.0",
  logo: "/logo.png",
} as const;

export const tokens = {
  color: {
    bgApp: "#0b0e14",
    bgPanel: "#141821",
    bgPanelAlt: "#1b2130",
    bgCanvas: "#08090c",
    border: "#232b3d",
    textPrimary: "#e8edf5",
    textSecondary: "#8a94a6",
    accent: "#0a84ff",
    accentHover: "#0070e0",
    accent2: "#38e1ff",
  },
  layout: {
    titleBarH: 40,
    menuBarH: 32,
    toolBarW: 52,
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
