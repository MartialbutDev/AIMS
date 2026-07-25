// src/components/common/AppLogo.tsx
import { Image, StyleSheet } from "react-native";
import { APP_NAME } from "../../constants/app";

interface AppLogoProps {
  size?: number;
  decorative?: boolean;
  variant?: 'default' | 'login';
}

export default function AppLogo({ 
  size = 220, 
  decorative = false,
  variant = 'default'
}: AppLogoProps) {
  // Choose the right image based on variant
  const getSource = () => {
    switch (variant) {
      case 'login':
        return require("../../../assets/images/login-page-logo.png");
      default:
        return require("../../../assets/images/aims-logo.png");
    }
  };

  return (
    <Image
      source={getSource()}
      style={[styles.logo, { width: size, height: size }]}
      resizeMode="contain"
      accessible={!decorative}
      accessibilityLabel={decorative ? undefined : `${APP_NAME} logo`}
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    // Size is now dynamic via props
  },
});