import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ThemePreset = "tinta" | "doble_partida" | "blanco";

export interface ThemeConfig {
  preset: ThemePreset;
  primaryColor: string;   // hex
  accentColor: string;
  secondaryColor: string; // "haber" / segundo acento — solo lo usa doble_partida
  borderRadius: "sm" | "md" | "lg";
  fontScale: "sm" | "md" | "lg";
}

// Identidades visuales completas: color + tipografía, no solo un color suelto.
export const PRESETS: Record<ThemePreset, {
  label: string;
  description: string;
  primaryColor: string;
  accentColor: string;
  secondaryColor: string;
  fontDisplay: string;
  fontMono: string;
  chrome: "dark" | "light";
}> = {
  tinta: {
    label: "Tinta y sello",
    description: "Azul institucional, un solo acento verde para “verificado”, serif en títulos.",
    primaryColor: "#13283D",
    accentColor: "#2F6F4E",
    secondaryColor: "#2F6F4E",
    fontDisplay: "'Source Serif 4','Iowan Old Style','Palatino Linotype',Georgia,serif",
    fontMono: "'IBM Plex Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace",
    chrome: "dark",
  },
  doble_partida: {
    label: "Doble partida",
    description: "Índigo para el Debe, ámbar para el Haber — el color sigue la lógica contable.",
    primaryColor: "#2E3F6E",
    accentColor: "#B8863B",
    secondaryColor: "#B8863B",
    fontDisplay: "'Manrope','Century Gothic',sans-serif",
    fontMono: "'Roboto Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace",
    chrome: "dark",
  },
  blanco: {
    label: "Blanco y color",
    description: "Lienzo blanco, un color de acento distinto por módulo — inspirado en QuickBooks.",
    primaryColor: "#2E5FDA",
    accentColor: "#0E8073",
    secondaryColor: "#0E8073",
    fontDisplay: "Inter,-apple-system,'Segoe UI',sans-serif",
    fontMono: "'IBM Plex Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace",
    chrome: "light",
  },
};

// Un color distinto por categoría del menú — solo se usa con chrome:"light" (preset "blanco").
export const CATEGORY_COLORS: Record<string, string> = {
  Principal: "#2E5FDA",
  Contabilidad: "#0E8073",
  "Compra y Venta": "#2E5FDA",
  "Clientes y Cobros": "#7B4FE0",
  Activos: "#E08A2E",
  "Herramientas y Cierres": "#1791C8",
};

const DEFAULT_THEME: ThemeConfig = {
  preset: "tinta",
  primaryColor: PRESETS.tinta.primaryColor,
  accentColor:  PRESETS.tinta.accentColor,
  secondaryColor: PRESETS.tinta.secondaryColor,
  borderRadius: "lg",
  fontScale:    "md",
};

const STORAGE_KEY = "scc_theme_config";

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 217, s: 47, l: 24 };
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// "R G B" (sin comas) — formato que espera rgb(var(--x) / <alpha-value>) en Tailwind
function hexToRgbChannels(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "19 40 61";
  return [1, 2, 3].map(i => parseInt(result[i], 16)).join(" ");
}

function applyTheme(theme: ThemeConfig) {
  const root = document.documentElement;
  const { h, s, l } = hexToHsl(theme.primaryColor);
  root.style.setProperty("--brand-h", String(h));
  root.style.setProperty("--brand-s", `${s}%`);
  root.style.setProperty("--brand-l", `${l}%`);
  root.style.setProperty("--brand-color", theme.primaryColor);
  root.style.setProperty("--brand-rgb", hexToRgbChannels(theme.primaryColor));
  root.style.setProperty("--brand-dark", `hsl(${h} ${s}% ${Math.max(0, l - 12)}%)`);
  root.style.setProperty("--accent-color", theme.accentColor);
  root.style.setProperty("--accent-rgb", hexToRgbChannels(theme.accentColor));
  const secondary = theme.secondaryColor || theme.accentColor;
  root.style.setProperty("--brand-secondary", secondary);
  root.style.setProperty("--brand-secondary-rgb", hexToRgbChannels(secondary));
  const radiusMap = { sm: "0.375rem", md: "0.625rem", lg: "0.875rem" };
  root.style.setProperty("--radius-card", radiusMap[theme.borderRadius]);
  const fontMap = { sm: "0.9", md: "1", lg: "1.1" };
  root.style.setProperty("--font-scale", fontMap[theme.fontScale]);

  const presetTokens = PRESETS[theme.preset] ?? PRESETS.tinta;
  root.style.setProperty("--font-display", presetTokens.fontDisplay);
  root.style.setProperty("--font-mono-data", presetTokens.fontMono);
  root.setAttribute("data-theme-preset", theme.preset);
  root.setAttribute("data-chrome", presetTokens.chrome);

  // Barra del navegador / splash de la PWA — que sigan el color de marca activo.
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.primaryColor);
  document.querySelector('link[rel="mask-icon"]')?.setAttribute("color", theme.primaryColor);

  if (presetTokens.chrome === "light") {
    root.style.setProperty("--sidebar-bg", "#FFFFFF");
    root.style.setProperty("--sidebar-fg", "#152232");
    root.style.setProperty("--sidebar-fg-muted", "#5F6368");
    root.style.setProperty("--sidebar-fg-faint", "#8A8F98");
    root.style.setProperty("--sidebar-border", "#E3E5E8");
    root.style.setProperty("--sidebar-hover", "#F5F7F9");
  } else {
    root.style.setProperty("--sidebar-bg", `linear-gradient(180deg, hsl(${h} ${s}% ${l}%), hsl(${h} ${s}% ${Math.max(0, l - 10)}%))`);
    root.style.setProperty("--sidebar-fg", "#FFFFFF");
    root.style.setProperty("--sidebar-fg-muted", "rgba(255,255,255,0.7)");
    root.style.setProperty("--sidebar-fg-faint", "rgba(255,255,255,0.5)");
    root.style.setProperty("--sidebar-border", "rgba(255,255,255,0.1)");
    root.style.setProperty("--sidebar-hover", "rgba(255,255,255,0.1)");
  }
}

interface ThemeContextType {
  theme: ThemeConfig;
  setTheme: (t: Partial<ThemeConfig>) => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  resetTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...DEFAULT_THEME, ...JSON.parse(saved) } : DEFAULT_THEME;
    } catch { return DEFAULT_THEME; }
  });

  useEffect(() => { applyTheme(theme); }, [theme]);

  const setTheme = (partial: Partial<ThemeConfig>) => {
    const next = { ...theme, ...partial };
    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const resetTheme = () => {
    setThemeState(DEFAULT_THEME);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() { return useContext(ThemeContext); }
