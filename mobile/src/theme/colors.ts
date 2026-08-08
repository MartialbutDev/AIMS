// src/theme/colors.ts
export const lightColors = {
  // Background
  background: '#F6F8FC',
  card: '#FFFFFF',
  
  // Text
  textPrimary: '#111827',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  
  // Brand
  primary: '#000080',      // ✅ UPDATED to Navy Blue
  primaryLight: '#1A1A9E',  // ✅ Updated lighter version
  primaryDark: '#000066',   // ✅ Updated darker version
  
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
  gradientStart: '#000080',   // ✅ Updated
  gradientEnd: '#1A1A9E',     // ✅ Updated
  
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
  background: '#0F172A',
  card: '#1E293B',
  
  // Text
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  
  // Brand
  primary: '#000080',      // ✅ UPDATED to Navy Blue
  primaryLight: '#2A2AB0',  // ✅ Updated lighter version
  primaryDark: '#000066',   // ✅ Updated darker version
  
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
  gradientStart: '#000080',   // ✅ Updated
  gradientEnd: '#2A2AB0',     // ✅ Updated
  
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
  primary: '#000080',      // ✅ UPDATED
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
  gradientStart: '#000080',   // ✅ Updated
  gradientEnd: '#1A1A9E',     // ✅ Updated
  pending: '#F59E0B',
  approved: '#10B981',
  rejected: '#EF4444',
  submitted: '#3B82F6',
  draft: '#6B7280',
  reviewing: '#8B5CF6',
};

export default Colors;