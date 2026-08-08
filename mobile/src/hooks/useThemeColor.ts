// src/hooks/useThemeColor.ts
import { useTheme } from '../context/ThemeContext';

export function useThemeColor() {
  const { colors, isDark } = useTheme();
  return { colors, isDark };
}

// Usage: const { colors } = useThemeColor();