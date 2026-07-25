import { Ionicons } from "@expo/vector-icons";
import React, { forwardRef, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from "react-native";

import Colors from "../../theme/colors";

export interface CustomTextInputProps extends TextInputProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  secure?: boolean;
  error?: string;
}

const CustomTextInput = forwardRef<TextInput, CustomTextInputProps>(
  ({ label, icon, secure = false, error, ...props }, ref) => {
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    return (
      <View style={styles.wrapper}>
        {/* Label */}
        <Text style={styles.label}>{label}</Text>

        {/* Input Container */}
        <View
          style={[
            styles.inputContainer,
            isFocused && styles.focusedContainer,
            error ? styles.errorContainer : null,
          ]}
        >
          {/* Left Icon */}
          <Ionicons
            name={icon}
            size={22}
            color={isFocused ? Colors.primary : "#8A8A8A"}
            style={styles.leftIcon}
          />

          {/* Input */}
          <TextInput
            ref={ref}
            {...props}
            style={styles.input}
            placeholderTextColor="#A0A0A0"
            secureTextEntry={secure && !isPasswordVisible}
            autoCapitalize="none"
            autoCorrect={false}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />

          {/* Password Toggle */}
          {secure && (
            <TouchableOpacity
              onPress={() => setIsPasswordVisible(!isPasswordVisible)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isPasswordVisible ? "eye-off-outline" : "eye-outline"}
                size={22}
                color="#8A8A8A"
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Error */}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  }
);

CustomTextInput.displayName = "CustomTextInput";

export default CustomTextInput;

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 22,
  },

  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 8,
    marginLeft: 2,
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 58,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    elevation: 2,
  },

  focusedContainer: {
    borderColor: Colors.primary,
    shadowOpacity: 0.1,
    elevation: 4,
  },

  errorContainer: {
    borderColor: "#EF4444",
  },

  leftIcon: {
    marginRight: 10,
  },

  input: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
  },

  errorText: {
    color: "#EF4444",
    marginTop: 6,
    marginLeft: 4,
    fontSize: 13,
  },
});