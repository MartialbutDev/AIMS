// src/theme/colors.ts
export const lightColors = {
  // Background
  background: '#F6F8FC',
  card: '#FFFFFF',
  
  // Text
  textPrimary: '#111827',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  
  // Brand - Navy Blue
  primary: '#000080',      // Navy Blue
  primaryLight: '#1A1A9E',
  primaryDark: '#000066',
  
  // Status
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  
  // Borders
  border: '#E8EDF5',
  borderLight: '#F1F5F9',
  
  // Surfaces
  surface: '#FFFFFF',
  surfaceSecondary: '#F8FAFC',
  surfaceTertiary: '#F1F5F9',
  
  // Shadows
  shadow: '#000000',
  
  // Gradients
  gradientStart: '#000080',
  gradientEnd: '#1A1A9E',
  
  // Status Badge Colors
  pending: '#F59E0B',
  approved: '#10B981',
  rejected: '#EF4444',
  submitted: '#3B82F6',
  draft: '#6B7280',
  reviewing: '#8B5CF6',
  
  // Additional colors for components
  white: '#FFFFFF',
  black: '#000000',
};

export const darkColors = {
  // Background
  background: '#0F172A',    // Dark slate
  card: '#1E293B',          // Dark card
  
  // Text
  textPrimary: '#F1F5F9',   // Light text
  textSecondary: '#94A3B8', // Gray text
  textTertiary: '#64748B',  // Darker gray text
  
  // Brand - Darker Navy for dark mode
  primary: '#000066',      // ✅ Darker Navy for dark mode
  primaryLight: '#1A1A8E',
  primaryDark: '#000040',
  
  // Status
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  
  // Borders
  border: '#334155',
  borderLight: '#1E293B',
  
  // Surfaces
  surface: '#1E293B',
  surfaceSecondary: '#334155',
  surfaceTertiary: '#0F172A',
  
  // Shadows
  shadow: '#000000',
  
  // Gradients
  gradientStart: '#000066',
  gradientEnd: '#1A1A8E',
  
  // Status Badge Colors (adjusted for dark mode)
  pending: '#F59E0B',
  approved: '#34D399',
  rejected: '#F87171',
  submitted: '#60A5FA',
  draft: '#94A3B8',
  reviewing: '#A78BFA',
  
  // Additional colors for components
  white: '#FFFFFF',
  black: '#000000',
};

export type ThemeColors = typeof lightColors;

// Default export for backward compatibility
const Colors = {
  primary: '#000080',
  background: '#F6F8FC',
  card: '#FFFFFF',
  textPrimary: '#111827',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  border: '#E8EDF5',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  white: '#FFFFFF',
  black: '#000000',
  surface: '#FFFFFF',
  surfaceSecondary: '#F8FAFC',
  surfaceTertiary: '#F1F5F9',
  shadow: '#000000',
  gradientStart: '#000080',
  gradientEnd: '#1A1A9E',
  pending: '#F59E0B',
  approved: '#10B981',
  rejected: '#EF4444',
  submitted: '#3B82F6',
  draft: '#6B7280',
  reviewing: '#8B5CF6',
};

export default Colors;