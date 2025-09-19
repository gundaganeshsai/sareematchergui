import Constants from 'expo-constants';
import * as ImageManipulator from 'expo-image-manipulator';
import { SaveFormat } from 'expo-image-manipulator';

import * as ImagePicker from 'expo-image-picker';
import * as React from 'react';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import HarmonyModalJewlery from "../utils/HarmonyModalJewlery";
import { usePermissions } from './_layout';

interface JewelryItem {
  id: string;
  name: string;
  category: 'necklace' | 'earrings' | 'bracelet' | 'ring' | 'watch';
  primaryColor: string;
  secondaryColors: string[];
  metalType: 'gold' | 'silver' | 'rose-gold' | 'platinum';
  confidence: number;
  image?: string;
  buyLink?: string;
  rating: number;
  reviews_count: number;
  site: string;
  description?: string;
  descriptionText?: string;
}

interface ColorMatch {
  color: string;
  harmony: string;
  confidence: number;
  reasoning: string;
}

export default function Explore() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const { hasLibraryPermission, hasCameraPermission } = usePermissions();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [realTimeMode, setRealTimeMode] = useState(true);
  const [jewelryMatches, setJewelryMatches] = useState<JewelryItem[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<JewelryItem | null>(null);
  const [showHarmonyModal, setShowHarmonyModal] = useState(false);
  const [selectedHarmony, setSelectedHarmony] = useState('complementary');
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState('');
  const [googleSearchQuery, setGoogleSearchQuery] = useState<string | null>(null); // New state for Google query  
  const [selectedJewelry, setSelectedJewelry] = useState<null | {
  value: string;
  description: string;
  image: string;
}>(null);




  // Analysis timeout for real-time mode
  const analysisTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // ✅ User picks harmony → analysis starts
// ✅ User picks harmony → analysis starts
const handleSelectHarmony = (option: {
  value: 'monochromatic' | 'complementary' | 'analogous' | 'triadic';
  description: string;
  image: string;
}) => {
  if (option) {
    setSelectedHarmony(option.value);   // keep your existing state for UI
    setSelectedJewelry(option);         // ✅ new state to hold full object (description + image)
  }
  setShowHarmonyModal(false);

  // Add small delay for smoothness (optional)
  analysisTimeout.current = setTimeout(() => {
    performRealTimeAnalysis();   // ✅ pass full object for backend query
  }, 800);
};

  // Logging utility
  const log = (message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[JewelryMatch ${timestamp}] ${message}`, data || '');
  };

  // Take photo with camera
  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const resized = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 800 } }],
          { compress: 0.8, format: SaveFormat.JPEG }
        );
        setSelectedImage(resized.uri);
      }
    } catch (err) {
      Alert.alert("Error", "Camera not available");
    }
  };

  // Pick image from gallery
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (err) {
      Alert.alert("Error", "Could not pick an image");
    }
  };

  

  // Real-time analysis effect with proper dependency management
  React.useEffect(() => {
    if (realTimeMode && selectedImage && !isAnalyzing && !hasAnalyzed) {
      log("Setting up real-time analysis timeout...");

      // Clear any existing timeout
      if (analysisTimeout.current) {
        clearTimeout(analysisTimeout.current);
      }

      // Set new timeout
      analysisTimeout.current = setTimeout(() => {
        setShowHarmonyModal(true);
        
      }, 1500); // 1.5 second delay for better UX
    }

    return () => {
      if (analysisTimeout.current) {
        clearTimeout(analysisTimeout.current);
      }
    };
  }, [selectedImage, realTimeMode, hasAnalyzed, isAnalyzing]);

  // Reset hasAnalyzed when images change
  React.useEffect(() => {
    setHasAnalyzed(false);
    setSelectedMatch(null);
    setJewelryMatches([]);
     setGoogleSearchQuery(null);
    log('Image changed, resetting analysis state');
  }, [selectedImage]);

  // Real-time analysis wrapper
  // Real-time analysis wrapper
const performRealTimeAnalysis = async (option?: {
  value: string;
  description: string;
  image: string;
}) => {
  if (!selectedImage) return;

  log("⚡ Performing real-time analysis...");

  // Build payload combining image + jewelry selection
  const payload = {
    image: selectedImage, // assuming this is a base64 or file object
    jewelry: {
      type: option?.value || selectedJewelry?.value || null,
      description: option?.description || selectedJewelry?.description || null,
      image: option?.image || selectedJewelry?.image || null,
    },
  };

  log("📦 Sending payload:", payload);

  // 🔍 Call your existing analyze function (with payload support)
  await handleAnalyze(payload);

  setHasAnalyzed(true);
};


const handleAnalyze = async (payload?: any) => {
  if (!selectedImage) {
    log("No image selected for analysis");
    return;
  }

  log("Starting jewelry analysis", {
    image: selectedImage,
    harmony: selectedHarmony,
    realTimeMode,
  });

  setIsAnalyzing(true);
  setJewelryMatches([]);
  setSelectedMatch(null);
  setAnalysisProgress("Initializing analysis...");

  const backendUrl =
    Constants.expoConfig?.extra?.API_BASE || "https://your-api-endpoint.com";

  try {
    setAnalysisProgress("Uploading image...");
    log("Sending request to backend", { url: `${backendUrl}/jewelry-search` });

    // Prepare FormData
    const formData = new FormData();
    formData.append("file", {
      uri: selectedImage,
      type: "image/jpeg",
      name: "upload.jpg",
    } as any);
      // ✅ Add jewelry details
  formData.append("type", payload?.jewelry?.value || selectedJewelry?.value || "");
  formData.append("description", payload?.jewelry?.description || selectedJewelry?.description || "");
  
    setAnalysisProgress("Analyzing colors...");

    // Send to backend
    const apiResponse = await fetch(`${backendUrl}/jewelry-search`, {
      method: "POST",
      body: formData,
    });

    setAnalysisProgress("Processing results...");

    if (!apiResponse.ok) {
      throw new Error(
        `API request failed: ${apiResponse.status} ${apiResponse.statusText}`
      );
    }

    const data = await apiResponse.json();
    log("API response received", data);

    // Save Google query for UI button
    if (data.query) {
      setGoogleSearchQuery(data.query); // New state: googleSearchQuery
    }

    setAnalysisProgress("Analysis complete!");
    setTimeout(() => setAnalysisProgress(""), 1000);
  } catch (error) {
    log("Analysis failed", error);
    setAnalysisProgress("Analysis failed");
    Alert.alert(
      "Analysis Failed",
      `Unable to analyze image: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    setTimeout(() => setAnalysisProgress(""), 2000);
  } finally {
    setIsAnalyzing(false);
    log("UI rendering matches:", jewelryMatches);
    log("Analysis completed");
  }
};



  const handleReset = () => {
    log('Resetting component state');
    setSelectedImage(null);
    setGoogleSearchQuery(null);
    setJewelryMatches([]);
    setSelectedMatch(null);
    setIsAnalyzing(false);
    setHasAnalyzed(false);
    setAnalysisProgress('');
  };

  const getCategoryIcon = (category: string) => {
    const icons = {
      necklace: '📿',
      earrings: '👂',
      bracelet: '💍',
      ring: '💎',
      watch: '⌚',
    };
    return icons[category as keyof typeof icons] || '✨';
  };

  const getMetalColor = (metalType: string) => {
    const colors = {
      gold: '#FFD700',
      silver: '#C0C0C0',
      'rose-gold': '#E6B8A2',
      platinum: '#E5E4E2',
    };
    return colors[metalType as keyof typeof colors] || '#C0C0C0';
  };

return (
    <View style={styles.container}>
      <ScrollView>
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.title}>✨ Jewelry Match</Text>
          <Text style={styles.subtitle}>
            AI-powered saree & jewelry color harmony
          </Text>
        </View>

        {/* IMAGE UPLOAD */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Upload Your Saree</Text>
          {selectedImage ? (
            <View style={styles.previewCard}>
              <Image source={{ uri: selectedImage }} style={styles.image} />
              <Text style={styles.previewLabel}>Your Saree is Ready ✅</Text>
            </View>
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderIcon}>🥻</Text>
              <Text style={styles.placeholderText}>
                Upload or capture your saree
              </Text>
            </View>
          )}
          <View style={styles.buttonRow}>
            {Platform.OS !== "web" && (
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  !hasCameraPermission && styles.disabledButton // gray if disabled
                ]}
                onPress={takePhoto}
                disabled={!hasCameraPermission}
              >
                <Text style={styles.buttonText}>📷 Take Photo</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.primaryButton,
                Platform.OS === 'web' && styles.fullWidthButton,
                !hasLibraryPermission && styles.disabledButton // gray if disabled
              ]}
              onPress={pickImage}
              disabled={!hasLibraryPermission}
            >
              <Text style={styles.buttonText}>{Platform.OS === 'web' ? '📁 Select Image' : '🖼️ From Gallery'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ANALYSIS FEEDBACK */}
        {(isAnalyzing || analysisProgress) && (
          <View style={styles.progressCard}>
            <ActivityIndicator size="large" color="#4caf50" />
            <Text style={styles.progressText}>
              {analysisProgress || "Analyzing your saree..."}
            </Text>
          </View>
        )}

        {/* HARMONY MODAL */}
        <HarmonyModalJewlery
          visible={showHarmonyModal}
          onSelect={handleSelectHarmony}

        />

        {/* SHOPPING SHORTCUT */}
        {googleSearchQuery && (
          <TouchableOpacity
            style={styles.shopButton}
            onPress={() =>
              Linking.openURL(
                `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(
                  googleSearchQuery
                )}`
              )
            }
          >
            <Text style={styles.shopText}>🛒 View Matches in Google Shopping</Text>
          </TouchableOpacity>
        )}

        {/* FOOTER */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            🎨 Powered by AI Color Harmony Engine
          </Text>
          <Text style={styles.footerSubtext}>
            Recommendations based on saree shades & jewelry trends
          </Text>
        </View>
      </ScrollView>

      {/* FLOATING RESET BUTTON */}
      {(selectedImage || googleSearchQuery) && (
        <TouchableOpacity style={styles.fab} onPress={handleReset}>
          <Text style={styles.fabText}>↺</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa" },
  header: {
    backgroundColor: "#e91e63",
    padding: 25,
    alignItems: "center",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  title: { fontSize: 24, color: "white", fontWeight: "bold" },
  subtitle: { fontSize: 14, color: "white", marginTop: 5 },
  section: { margin: 15, padding: 20, backgroundColor: "white", borderRadius: 15, elevation: 3 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 10, color: "#333" },

  placeholder: {
    height: 180,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#ccc",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    marginBottom: 15,
  },
  placeholderIcon: { fontSize: 40, marginBottom: 8 },
  placeholderText: { fontSize: 14, color: "#666" },

  previewCard: { alignItems: "center", marginBottom: 15 },
  image: { width: "100%", height: 200, borderRadius: 12 },
  previewLabel: { marginTop: 8, fontSize: 13, color: "#4caf50", fontWeight: "bold" },

  buttonRow: { flexDirection: "row", justifyContent: "space-around", marginTop: 10 },
  primaryButton: {
    backgroundColor: "#1976d2",
    padding: 12,
    borderRadius: 10,
    minWidth: 130,
    alignItems: "center",
  },
  secondaryButton: {
    backgroundColor: "#555",
    padding: 12,
    borderRadius: 10,
    minWidth: 130,
    alignItems: "center",
  },
  buttonText: { color: "white", fontWeight: "bold" },

  progressCard: {
    margin: 15,
    backgroundColor: "#f1f8e9",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
  },
  progressText: { marginTop: 10, fontSize: 14, color: "#2e7d32" },

  shopButton: {
    margin: 15,
    backgroundColor: "#ff7043",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  shopText: { color: "white", fontWeight: "bold" },
    disabledButton: {
    backgroundColor: '#9e9e9e',
  },

  footer: { padding: 20, alignItems: "center" },
  footerText: { fontSize: 12, color: "#555", fontStyle: "italic" },
  footerSubtext: { fontSize: 11, color: "#888", marginTop: 3 },
    fullWidthButton: {
    minWidth: '80%',
  },

  fab: {
    position: "absolute",
    bottom: 25,
    right: 25,
    backgroundColor: "#f44336",
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
  },
  fabText: { color: "white", fontSize: 22, fontWeight: "bold" },
});