import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";

export interface ThemeConfig {
  primaryColor: string;   // hex
  accentColor: string;
  borderRadius: "sm" | "md" | "lg";
  fontScale: "sm" | "md" | "lg";
}

const DEFAULT_THEME: ThemeConfig = {
  primaryColor: "#1E3A5F",
  accentColor:  "#10B981",
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

function applyTheme(theme: ThemeConfig) {
  const root = document.documentElement;
  const { h, s, l } = hexToHsl(theme.primaryColor);
  root.style.setProperty("--brand-h", String(h));
  root.style.setProperty("--brand-s", `${s}%`);
  root.style.setProperty("--brand-l", `${l}%`);
  root.style.setProperty("--brand-color", theme.primaryColor);
  root.style.setProperty("--accent-color", theme.accentColor);
  const radiusMap = { sm: "0.375rem", md: "0.625rem", lg: "0.875rem" };
  root.style.setProperty("--radius-card", radiusMap[theme.borderRadius]);
  const fontMap = { sm: "0.9", md: "1", lg: "1.1" };
  root.style.setProperty("--font-scale", fontMap[theme.fontScale]);
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
