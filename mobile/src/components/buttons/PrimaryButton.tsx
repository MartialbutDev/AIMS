import { Pressable, StyleSheet, Text } from "react-native";
import Colors from "../../theme/colors";

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
};

export default function PrimaryButton({
  title,
  onPress,
  disabled = false,
}: Props) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.text, disabled && styles.textDisabled]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.white,
    paddingVertical: 16,
    paddingHorizontal: 60,
    borderRadius: 50,
    elevation: 4,
  },

  buttonDisabled: {
    opacity: 0.6,
    elevation: 0,
  },

  buttonPressed: {
    opacity: 0.85,
  },

  text: {
    color: Colors.primary,
    fontWeight: "700",
    fontSize: 18,
  },

  textDisabled: {
    color: Colors.textSecondary,
  },
});