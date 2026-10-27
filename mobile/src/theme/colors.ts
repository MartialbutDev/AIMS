// src/theme/colors.ts
export const lightColors = {
  accent: '#000080',
  accentMuted: '#EBEBF8',
  onAccent: '#FFFFFF',
  inputBackground: '#FFFFFF',
  tabBackground: '#FFFFFF',
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
  // Readable foreground accents are separate from filled button backgrounds.
  accent: '#FFC629',
  accentMuted: '#342D20',
  onAccent: '#0B0B2F',
  inputBackground: '#101629',
  tabBackground: '#171D33',
  // Background
  background: '#0B0D1B',    
  card: '#151A2E',          
  
  // Text
  textPrimary: '#F4F6FF',   
  textSecondary: '#BCC5DA', 
  textTertiary: '#9AA8C4',  
  
  // Brand - Darker Navy for dark mode
  primary: '#353E7C',      
  primaryLight: '#46529B',
  primaryDark: '#252C5B',
  
  // Status
  success: '#6EE7B7',
  warning: '#FFD46B',
  error: '#FF9FA9',
  info: '#A8CFFF',
  
  // Borders
  border: '#35415F',
  borderLight: '#252F48',
  
  // Surfaces
  surface: '#151A2E',
  surfaceSecondary: '#1D253D',
  surfaceTertiary: '#27324B',
  
  // Shadows
  shadow: '#000000',
  
  // Gradients
  gradientStart: '#171B3A',
  gradientEnd: '#242B53',
  
  // Status Badge Colors (adjusted for dark mode)
  pending: '#FFD46B',
  approved: '#6EE7B7',
  rejected: '#FF9FA9',
  submitted: '#A8CFFF',
  draft: '#AAB6CE',
  reviewing: '#D2B5FF',
  
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