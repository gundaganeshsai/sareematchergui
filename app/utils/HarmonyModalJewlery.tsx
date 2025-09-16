import { MotiView } from "moti";
import React from "react";
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

// 🎨 Define strict Harmony type
export type HarmonyOption = "monochromatic" | "complementary" | "analogous" | "triadic";

export interface JewelryOption {
  value: HarmonyOption;
  label: string;
  description: string;
  image: string; // ✅ Added
}

interface HarmonyModalProps {
  visible: boolean;
  onSelect: (option: JewelryOption) => void; // ✅ Send whole object instead of only value
}

const harmonyOptions: JewelryOption[] = [
  { 
    value: "monochromatic", 
    label: "🎯 Exact Match", 
    description: "Diamond or platinum jewelry for subtle sophistication", 
    image: "https://example.com/diamond.jpg" 
  },
  { 
    value: "complementary", 
    label: "🔄 Opposite Match", 
    description: "Statement necklaces or bangles that pop against the saree", 
    image: "https://example.com/necklace.jpg" 
  },
  { 
    value: "analogous", 
    label: "🌈 Smooth Match", 
    description: "Gold chains or pearl sets that softly match the saree shades", 
    image: "https://example.com/pearl.jpg" 
  },
  { 
    value: "triadic", 
    label: "✨ Stylish Match", 
    description: "Colorful gemstone sets (ruby, emerald, sapphire) for lively balance", 
    image: "https://example.com/gemstones.jpg" 
  },
];

export default function HarmonyModalJewlery({ visible, onSelect }: HarmonyModalProps) {
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
              onPress={() => onSelect(option)} // ✅ Pass whole object
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Image source={{ uri: option.image }} style={styles.optionImage} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  <Text style={styles.optionDesc}>{option.description}</Text>
                </View>
              </View>
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
    backgroundColor: "rgba(0,0,0,0.6)",
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
  optionImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
});
