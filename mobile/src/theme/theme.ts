// src/theme/theme.ts
import { lightColors, darkColors, ThemeColors } from './colors';

export type ThemeMode = 'light' | 'dark';

export const themes: Record<ThemeMode, ThemeColors> = {
  light: lightColors,
  dark: darkColors,
};

export const getTheme = (mode: ThemeMode): ThemeColors => {
  return themes[mode];
};

// Re-export types
export type { ThemeColors };