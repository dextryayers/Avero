export const tokens = {
  color: {
    bgApp: "#1e1e1e",
    bgPanel: "#252526",
    bgPanelAlt: "#2d2d2d",
    bgCanvas: "#141414",
    border: "#3e3e42",
    textPrimary: "#e0e0e0",
    textSecondary: "#a0a0a0",
    accent: "#0a84ff",
    accentHover: "#0070e0",
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
