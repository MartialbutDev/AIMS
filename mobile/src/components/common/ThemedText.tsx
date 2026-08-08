// src/components/common/ThemedText.tsx
import { Text, TextProps } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface ThemedTextProps extends TextProps {
  lightColor?: string;
  darkColor?: string;
  type?: 'primary' | 'secondary' | 'tertiary';
}

export function ThemedText({ 
  style, 
  lightColor, 
  darkColor, 
  type = 'primary',
  ...props 
}: ThemedTextProps) {
  const { colors, isDark } = useTheme();
  
  const getColor = () => {
    if (lightColor && !isDark) return lightColor;
    if (darkColor && isDark) return darkColor;
    
    switch (type) {
      case 'primary':
        return colors.textPrimary;
      case 'secondary':
        return colors.textSecondary;
      case 'tertiary':
        return colors.textTertiary;
      default:
        return colors.textPrimary;
    }
  };
  
  return <Text style={[{ color: getColor() }, style]} {...props} />;
}