import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { ActivityIndicator, View } from "react-native";

import { useTheme } from "../src/context/ThemeContext";

export default function LaunchScreen() {
  const { colors } = useTheme();
  const [destination, setDestination] = useState<"/onboarding" | "/(auth)/login" | null>(null);

  useEffect(() => {
    let cancelled = false;
    void SecureStore.getItemAsync("access_token")
      .then((token) => {
        if (!cancelled) setDestination(token ? "/onboarding" : "/(auth)/login");
      })
      .catch(() => {
        if (!cancelled) setDestination("/(auth)/login");
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
