import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import PrimaryButton from "../src/components/buttons/PrimaryButton";
import AppLogo from "../src/components/common/AppLogo";
import Colors from "../src/theme/colors";

export default function LandingPage() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <AppLogo />

        <Text style={styles.title}>Academic Internship Management System</Text>
      </View>

      <PrimaryButton
        title="Get Started"
        onPress={() => router.push("/(auth)/login")}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
    justifyContent: "space-between",
    alignItems: "center",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  title: {
    marginTop: 20,
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 20,
  },
});