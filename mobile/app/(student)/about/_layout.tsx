// app/(student)/about/_layout.tsx
import { Stack } from "expo-router";

export default function AboutLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    />
  );
}