import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { resolveLaunchDestination, type LaunchDestination } from "../src/services/welcome.service";
import { ActivityIndicator, View } from "react-native";

import { useTheme } from "../src/context/ThemeContext";

export default function LaunchScreen() {
  const { colors } = useTheme();
  const [destination, setDestination] = useState<LaunchDestination | null>(null);

  useEffect(() => {
    let cancelled = false;
    void resolveLaunchDestination().then(next => {
      if (!cancelled) setDestination(next);
    });
    return () => { cancelled = true; };
  }, []);

  if (destination) return <Redirect href={destination} />;

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
