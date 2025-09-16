import { MotiView } from "moti";
import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

// 🎨 Define strict Harmony type
export type HarmonyOption = "monochromatic" | "complementary" | "analogous" | "triadic";

interface HarmonyModalProps {
  visible: boolean;
  onSelect: (harmony: HarmonyOption) => void;
}

const harmonyOptions: { value: HarmonyOption; label: string; description: string }[] = [
  { value: "monochromatic", label: "🎯 Exact Match", description: "100% match, shades of the same color" },
  { value: "complementary", label: "🔄 Opposite Match", description: "Bold & opposite colors (high contrast)" },
  { value: "analogous", label: "🌈 Smooth Match", description: "Neighboring colors (soft, traditional)" },
  { value: "triadic", label: "✨ Stylish Match", description: "Three distinct colors (modern & trendy)" },
];

export default function HarmonyModal({ visible, onSelect }: HarmonyModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <MotiView
          from={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 15 }}
          style={styles.modalContent}
        >
          <Text style={styles.title}>🎨 Select Your Style</Text>
          <Text style={styles.subtitle}>Choose how you want colors to match</Text>

          {harmonyOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={styles.option}
              onPress={() => onSelect(option.value)}
            >
              <Text style={styles.optionLabel}>{option.label}</Text>
              <Text style={styles.optionDesc}>{option.description}</Text>
            </TouchableOpacity>
          ))}
        </MotiView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)", // blurred background feel
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "85%",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
    textAlign: "center",
  },
  option: {
    backgroundColor: "#f8f8f8",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  optionDesc: {
    fontSize: 13,
    color: "#555",
    marginTop: 4,
  },
});
