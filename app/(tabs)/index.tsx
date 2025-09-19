import Constants from "expo-constants";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from 'expo-image-picker';
import React, { useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import HarmonyModal from "../utils/HarmonyModal";
import { usePermissions } from "./_layout";
const { width, height } = Dimensions.get('window');

//   const uriToBase64 = async (uri: string): Promise<string> => {
//   return await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
// };
interface PositionData {
  original: { x: number; y: number }; // raw pixel position from image analysis
  scaled: { x: number; y: number };   // normalized / scaled to display
  bounded: { x: number; y: number };  // clamped to fit inside preview
}

// Enhanced Match interface with additional color analysis data
interface Match {
  id: number;
  x: number;
  y: number;
  originalX?: number; // original position before scaling
  originalY?: number;
  confidence: number;
  colorName: string;
  hexColor: string;
  dominantColor?: string;
  complementaryColors?: string[];
  category?: string;
  harmony?: string;
  reasoning?: string;
  detectedAt?: PositionData; // store all forms of position
}

interface ImageDimensions {
  width: number;
  height: number;
}

// Color Analysis Result interface
interface ColorAnalysisResult {
  matches: Match[];
  processingTime: number;
  imageAnalysis: {
    dominantColors: string[];
    colorPalette: string[];
    harmony: 'complementary' | 'analogous' | 'triadic' | 'monochromatic';
  };
  sareeColors?: string[];   // detected saree colors
  blouseColors?: string[];  // detected blouse colors
  reasoning?: string[];     // why it matched
}

// Color theory utilities
class ColorTheory {
  static hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  static rgbToHex(r: number, g: number, b: number): string {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  static rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  }

  static getComplementaryColor(hex: string): string {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return hex;
    return this.rgbToHex(255 - rgb.r, 255 - rgb.g, 255 - rgb.b);
  }

  static getAnalogousColors(hex: string): string[] {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return [hex];
    
    const hsl = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
    const analogous: string[] = [];
    
    for (let i = -30; i <= 30; i += 15) {
      if (i === 0) continue;
      const newHue = (hsl.h + i + 360) % 360;
      const newRgb = this.hslToRgb(newHue, hsl.s, hsl.l);
      analogous.push(this.rgbToHex(Math.round(newRgb.r), Math.round(newRgb.g), Math.round(newRgb.b)));
    }
    
    return analogous;
  }

  static hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    h /= 360;
    s /= 100;
    l /= 100;
    
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return { r: r * 255, g: g * 255, b: b * 255 };
  }

  static calculateColorHarmony(colors: string[]): 'complementary' | 'analogous' | 'triadic' | 'monochromatic' {
    if (colors.length < 2) return 'monochromatic';
    
    const hues = colors.map(color => {
      const rgb = this.hexToRgb(color);
      if (!rgb) return 0;
      return this.rgbToHsl(rgb.r, rgb.g, rgb.b).h;
    });

    const avgHueDiff = hues.reduce((sum, hue, i) => {
      if (i === 0) return 0;
      return sum + Math.abs(hue - hues[i - 1]);
    }, 0) / (hues.length - 1);

    if (avgHueDiff < 30) return 'monochromatic';
    if (avgHueDiff > 150) return 'complementary';
    if (avgHueDiff > 90) return 'triadic';
    return 'analogous';
  }
}

// ColorPixel type for backend color analysis results
type ColorPixel = {
  hex: string;
  positions: Array<{ x: number; y: number }>;
  colorName: string
};

// Advanced color matching engine with exact position tracking
class ColorMatcher {
  static backendUrl = Constants.expoConfig?.extra?.API_BASE;
  
  // Call FastAPI backend instead of Vision API
  static async analyzeImageColors(imageUri: string): Promise<ColorPixel[]> {
    const formData = new FormData();
    formData.append("file", {
      uri: imageUri,
      type: "image/jpeg",
      name: "upload.jpg",
    } as any);

    const response = await fetch(`${this.backendUrl}/analyze`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Failed to analyze image colors");
    }

    const data = await response.json();
    // console.log(JSON.stringify(data, null, 2));
    // console.log('Received colors from backend:', data.colors);
  
    return data.colors || []; // [{hex:"#aabbcc", positions:[{x,y}, ...]}]
  }

  // Find best matches with detailed position tracking
static async findOptimalMatches(
  sareeColors: ColorPixel[],
  rackColors: ColorPixel[],
  positions: Array<{ x: number; y: number }>,
  sensitivity: "low" | "medium" | "high" = "medium",
  rackImageDimensions: { width: number; height: number },
  previewWidth: number,
  previewHeight: number,
  maxPositionsPerColor = 5 // Limit positions to avoid too many markers
): Promise<Match[]> {
  const thresholds = { low: 80, medium: 60, high: 40 };
  const threshold = thresholds[sensitivity];
  const matches: Match[] = [];
  let matchId = 1;

  const scaleX = previewWidth / rackImageDimensions.width;
  const scaleY = previewHeight / rackImageDimensions.height;

  for (const sareeColorObj of sareeColors) {
    const sareeRgb = ColorTheory.hexToRgb(sareeColorObj.hex);
    if (!sareeRgb) continue;

    for (const rackColorObj of rackColors) {
      const rackRgb = ColorTheory.hexToRgb(rackColorObj.hex);
      if (!rackRgb) continue;

      let confidence = 0;
      const reasons: string[] = [];

      // Direct color similarity
      const delta = Math.sqrt(
        Math.pow(sareeRgb.r - rackRgb.r, 2) +
        Math.pow(sareeRgb.g - rackRgb.g, 2) +
        Math.pow(sareeRgb.b - rackRgb.b, 2)
      );
      if (delta < threshold) {
        confidence = Math.max(confidence, 100 - (delta / threshold) * 100);
        reasons.push("Direct color similarity");
      }

      // Complementary colors
      const complementary = ColorTheory.getComplementaryColor(sareeColorObj.hex);
      const compRgb = ColorTheory.hexToRgb(complementary);
      if (compRgb) {
        const compDelta = Math.sqrt(
          Math.pow(compRgb.r - rackRgb.r, 2) +
          Math.pow(compRgb.g - rackRgb.g, 2) +
          Math.pow(compRgb.b - rackRgb.b, 2)
        );
        if (compDelta < threshold) {
          confidence = Math.max(confidence, 95 - (compDelta / threshold) * 15);
          reasons.push("Complementary color match");
        }
      }

      // Analogous colors
      const analogous = ColorTheory.getAnalogousColors(sareeColorObj.hex);
      for (const anaColor of analogous) {
        const anaRgb = ColorTheory.hexToRgb(anaColor);
        if (anaRgb) {
          const anaDelta = Math.sqrt(
            Math.pow(anaRgb.r - rackRgb.r, 2) +
            Math.pow(anaRgb.g - rackRgb.g, 2) +
            Math.pow(anaRgb.b - rackRgb.b, 2)
          );
          if (anaDelta < threshold) {
            confidence = Math.max(confidence, 85 - (anaDelta / threshold) * 15);
            reasons.push("Analogous color match");
          }
        }
      }

      // Neutral combination
      const sareeHsl = ColorTheory.rgbToHsl(sareeRgb.r, sareeRgb.g, sareeRgb.b);
      const rackHsl = ColorTheory.rgbToHsl(rackRgb.r, rackRgb.g, rackRgb.b);
      if (rackHsl.s < 20 || sareeHsl.s < 20) {
        confidence = Math.max(confidence, 80);
        reasons.push("Neutral tone combination");
      }

      // Add match if confidence is high enough
      if (confidence > 70) {
        const detectedPositions = rackColorObj.positions && rackColorObj.positions.length > 0
          ? rackColorObj.positions
          : positions; // fallback if positions from CV not available

        // Limit the number of positions to display
        const positionsToUse = detectedPositions.slice(0, maxPositionsPerColor);

        for (const rawPos of positionsToUse) {
          const scaledX = rawPos.x * scaleX;
          const scaledY = rawPos.y * scaleY;

          const boundedX = Math.max(25, Math.min(scaledX, previewWidth - 25));
          const boundedY = Math.max(25, Math.min(scaledY, previewHeight - 25));

          matches.push({
            id: matchId++,
            x: boundedX,
            y: boundedY,
            originalX: rawPos.x,
            originalY: rawPos.y,
            confidence: Math.round(confidence),
            colorName: rackColorObj.colorName || `Rack Color ${matchId}`,
            hexColor: rackColorObj.hex,
            dominantColor: sareeColorObj.hex,
            complementaryColors: [complementary, ...analogous.slice(0, 2)],
            category: "rack",
            harmony: ColorTheory.calculateColorHarmony([sareeColorObj.hex, rackColorObj.hex]),
            reasoning: reasons.join(", "),
            detectedAt: {
              original: rawPos,
              scaled: { x: scaledX, y: scaledY },
              bounded: { x: boundedX, y: boundedY }
            }
          });
        }
      }
    }
  }

  // Remove duplicate positions if needed
  const uniqueMatches = this.removeDuplicatePositions(matches);

  return uniqueMatches.sort((a, b) => b.confidence - a.confidence).slice(0, 8);
}

  // Helper method to remove matches at very similar positions
  static removeDuplicatePositions(matches: Match[], threshold: number = 30): Match[] {
    const filtered: Match[] = [];
    
    for (const match of matches) {
      const isDuplicate = filtered.some(existing => {
        const distance = Math.sqrt(
          Math.pow(match.x - existing.x, 2) + 
          Math.pow(match.y - existing.y, 2)
        );
        return distance < threshold;
      });
      
      if (!isDuplicate) {
        filtered.push(match);
      }
    }
    
    return filtered;
  }

  // Helper method to get all positions for a specific color match
  static getAllPositionsForColor(
    rackColorObj: ColorPixel, 
    scaleX: number, 
    scaleY: number, 
    previewWidth: number, 
    previewHeight: number
  ): Array<{x: number, y: number}> {
    if (!rackColorObj.positions || rackColorObj.positions.length === 0) {
      return [];
    }

    return rackColorObj.positions.map(pos => {
      const scaledX = pos.x * scaleX;
      const scaledY = pos.y * scaleY;
      
      return {
        x: Math.max(25, Math.min(scaledX, previewWidth - 25)),
        y: Math.max(25, Math.min(scaledY, previewHeight - 25))
      };
    });
  }
}

export default function HomeScreen() {
    const { hasLibraryPermission, hasCameraPermission } = usePermissions();
  const [sareeImage, setSareeImage] = useState<string | null>(null);
  const [rackImage, setRackImage] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [rackImageDimensions, setRackImageDimensions] = useState<ImageDimensions>({ width: 0, height: 0 });
  const [selectedMatch, setSelectedMatch] = useState<number | null>(null);
  const [analysisResult, setAnalysisResult] = useState<ColorAnalysisResult | null>(null);
  const [realTimeMode, setRealTimeMode] = useState(true);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [selectedHarmony, setSelectedHarmony] = useState<
  'monochromatic' | 'complementary' | 'analogous' | 'triadic' | null
>(null);
const [showHarmonyModal, setShowHarmonyModal] = useState(false); // show at image selection
    // Logging utility
  const log = (message: string, messagetwo: string,data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[SareeMatch ${timestamp}] ${message} ${messagetwo}`, data || '');
  };
  
  // Analysis timeout for real-time mode
  const analysisTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Fixed image preview dimensions
  const imagePreviewWidth = width - 70;
  const imagePreviewHeight = 220;

  // Handle image load to get dimensions - Fixed
  const handleRackImageLoad = (event: any) => {
    const { width: imgWidth, height: imgHeight } = event.nativeEvent.source;
    log('Image loaded with dimensions:', imgWidth, imgHeight);
    setRackImageDimensions({ width: imgWidth, height: imgHeight });
  };
  const getTextColor = (hex: string) => {
  // Convert HEX to RGB
  const r = parseInt(hex.substring(1, 3), 16);
  const g = parseInt(hex.substring(3, 5), 16);
  const b = parseInt(hex.substring(5, 7), 16);
  // Perceived brightness formula
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? '#000' : '#fff'; // Dark text if light bg
};

const harmonyUseCases: Record<string, string> = {
  monochromatic: "Formal office wear (Ex: Shades of Blue)",
  complementary: "🥳 Party/ceremony sarees (Ex: Red + Green)",
  analogous: "🪔 Traditional combinations (Ex: Orange + Red + Yellow saree borders)",
  triadic: "✨ Modern fashion (Ex: Bold Red, Blue, Yellow outfits)",
};
// Create a hex -> name lookup from your analysisResult data
const nameByHex = React.useMemo(() => {
  const map: Record<string, string> = {};

  // From "Saree Colors: Pink (#aabbcc)" etc
  analysisResult?.sareeColors?.forEach(s => {
    const m = s.match(/(.*)\s\((#[0-9a-fA-F]{6})\)/);
    if (m) map[m[2].toLowerCase()] = m[1].trim();
  });

  // From "Blouse Colors: Navy (#112233)" etc
  analysisResult?.blouseColors?.forEach(s => {
    const m = s.match(/(.*)\s\((#[0-9a-fA-F]{6})\)/);
    if (m) map[m[2].toLowerCase()] = m[1].trim();
  });

  // Also learn names from matches (e.g., "Rack Color Navy")
  analysisResult?.matches?.forEach(m => {
    if (m.hexColor) {
      const n = (m.colorName || '').replace(/^Rack Color\s*/i, '').trim();
      if (n) map[m.hexColor.toLowerCase()] = n;
    }
  });

  return map;
}, [analysisResult]);

  // Generate realistic blouse positions - Fixed to use preview dimensions
  const generateBlousePositions = () => {
    const positions = [];
    const rows = 3;
    const itemsPerRow = 4;
    
    const usableWidth = imagePreviewWidth * 0.8;
    const usableHeight = imagePreviewHeight * 0.8;
    const offsetX = imagePreviewWidth * 0.1;
    const offsetY = imagePreviewHeight * 0.1;
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < itemsPerRow; col++) {
        const x = offsetX + (usableWidth / itemsPerRow) * (col + 0.5);
        const y = offsetY + (usableHeight / rows) * (row + 0.5);
        positions.push({ 
          x: Math.round(x), 
          y: Math.round(y) 
        });
      }
    }
    return positions;
  };

  
// ✅ User picks harmony → analysis starts
const handleSelectHarmony = (harmony: 'monochromatic' | 'complementary' | 'analogous' | 'triadic' | null) => {
  setSelectedHarmony(harmony);
  setShowHarmonyModal(false);

  // Add small delay for smoothness (optional)
  analysisTimeout.current = setTimeout(() => {
    performRealTimeAnalysis();
  }, 800);
};

  // Real-time color analysis function - FIXED to prevent infinite loops
  const performRealTimeAnalysis = async () => {
  if (!sareeImage || !rackImage || isAnalyzing || hasAnalyzed) {
    return;
  }

  console.log('Starting real-time analysis...');
  setIsAnalyzing(true);
  const startTime = Date.now();

  try {
    // Extract dominant colors from saree image (main shades)
    const sareeColors = await ColorMatcher.analyzeImageColors(sareeImage);

    // Extract full palette from rack image (many shades)
    const rackColors = await ColorMatcher.analyzeImageColors(rackImage);

    // Generate positions for matches
    const positions = generateBlousePositions();

    // 🔑 Update: Compare saree vs rack colors (not static DB)
    const foundMatches = await ColorMatcher.findOptimalMatches(
      sareeColors,
      rackColors,
      positions,
      'medium',
      rackImageDimensions,   // from onLoad
      imagePreviewWidth,     // UI preview width
      imagePreviewHeight     // UI preview height
    );
    const filteredMatches = selectedHarmony
  ? foundMatches.filter(m => m.harmony === selectedHarmony)
  : foundMatches;

    const processingTime = Date.now() - startTime;

    const result: ColorAnalysisResult = {
      matches: filteredMatches,
      processingTime,
      imageAnalysis: {
        dominantColors: sareeColors.map(c => c.hex),
        colorPalette: rackColors.map(c => c.hex), // all rack colors
        harmony: ColorTheory.calculateColorHarmony([...sareeColors.map(c => c.hex), ...rackColors.map(c => c.hex)])
      },
    sareeColors: sareeColors.map(c => `${c.colorName} (${c.hex})`),
    blouseColors: rackColors.map(c => `${c.colorName} (${c.hex})`),
    reasoning: filteredMatches.map(m =>
      `Matched Saree ${m.dominantColor} with Blouse ${m.hexColor} (${m.harmony} harmony, confidence ${m.confidence}%)`
    ),
    };

    setMatches(filteredMatches);
    setAnalysisResult(result);
    setHasAnalyzed(true);

    if (filteredMatches.length > 0) {
      Alert.alert(
        '✨ Perfect Matches Found!',
        `Discovered ${filteredMatches.length} excellent color combinations with ${Math.round(
          filteredMatches[0].confidence
        )}% confidence.\n\nAnalysis completed in ${processingTime}ms.\n\nColor harmony: ${result.imageAnalysis.harmony}`
      );
    } else {
      Alert.alert('No Matches Found', 'Try different images or adjust sensitivity.');
    }
  } catch (error) {
    console.error('Color analysis error:', error);
    Alert.alert('Analysis Error', 'Failed to analyze colors. Please try again.');
  } finally {
    setIsAnalyzing(false);
  }
};


  // FIXED: Real-time analysis effect with proper dependency management
  React.useEffect(() => {
    if (realTimeMode && sareeImage && rackImage && rackImageDimensions.width && rackImageDimensions.height &&!isAnalyzing && !hasAnalyzed) {
      console.log('Setting up real-time analysis timeout...');
      
      // Clear any existing timeout
      if (analysisTimeout.current) {
        clearTimeout(analysisTimeout.current);
      }

      // Set new timeout
      analysisTimeout.current = setTimeout(() => {
        
        // ✅ Show modal instead of auto-analysis
        setShowHarmonyModal(true);
      }, 1500); // 1.5 second delay for better UX
    }

    return () => {
      if (analysisTimeout.current) {
        clearTimeout(analysisTimeout.current);
      }
    };
  }, [sareeImage, rackImage, realTimeMode, hasAnalyzed,  rackImageDimensions]); // FIXED: Removed performRealTimeAnalysis from dependencies

  // FIXED: Reset hasAnalyzed when images change
  React.useEffect(() => {
    setHasAnalyzed(false);
    setMatches([]);
    setAnalysisResult(null);
    setSelectedMatch(null);
  }, [sareeImage, rackImage]);
  const harmonyOptions: { label: string; value: 'monochromatic' | 'complementary' | 'analogous' | 'triadic' }[] = [
  { label: "🎯 Exact Match (100%)", value: "monochromatic" },
  { label: "🔄 Opposite Colors", value: "complementary" },
  { label: "🌈 Similar Shades", value: "analogous" },
  { label: "✨ Bold Mix", value: "triadic" },
];

  // Take photo with camera
  const takePhoto = async (mode: 'saree' | 'rack') => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const resizedImage = await manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 800 } }],
          { compress: 0.8, format: SaveFormat.JPEG }
        );
        
        if (mode === 'saree') {
          setSareeImage(resizedImage.uri);
        } else if (mode === 'rack') {
          setRackImage(resizedImage.uri);
        }
      }
    } catch (error) {
      Alert.alert('Error', `Failed to take photo: ${error}`);
    }
  };
//   const takePhoto = async (mode: 'saree' | 'rack') => {
//   try {
//     const image = await ImageCropPicker.openCamera({
//       width: 800,
//       height: 600,
//       cropping: true,   // ✅ enables custom cropper
//       includeBase64: false,
//       compressImageQuality: 0.8,
//     });

//     if (mode === 'saree') {
//       setSareeImage(image.path);
//     } else if (mode === 'rack') {
//       setRackImage(image.path);
//     }
//   } catch (error) {
//     Alert.alert('Error', `Failed to take photo: ${error}`);
//   }
// };

  // Pick image from gallery
  const pickImage = async (mode: 'saree' | 'rack') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        if (mode === 'saree') {
          setSareeImage(result.assets[0].uri);
        } else if (mode === 'rack') {
          setRackImage(result.assets[0].uri);
        }
      }
    } catch (error) {
      Alert.alert('Error', `Failed to pick image: ${error}`);
    }
  };
//   const pickImage = async (mode: 'saree' | 'rack') => {
//   try {
//     const image = await ImageCropPicker.openPicker({
//       width: 800,
//       height: 600,
//       cropping: true,
//       includeBase64: false,
//       compressImageQuality: 0.8,
//     });

//     if (mode === 'saree') {
//       setSareeImage(image.path);
//     } else if (mode === 'rack') {
//       setRackImage(image.path);
//     }
//   } catch (error) {
//     Alert.alert('Error', `Failed to select photo: ${error}`);
//   }
// };

  // Manual analysis trigger (for non-real-time mode)
  const findColorMatches = async () => {
    if (!sareeImage || !rackImage) {
      Alert.alert('Missing Images', 'Please select both saree and blouse rack images');
      return;
    }

    setHasAnalyzed(false); // Reset the flag for manual analysis
    await performRealTimeAnalysis();
  };

  // Reset all data
  const resetApp = () => {
    setSareeImage(null);
    setRackImage(null);
    setMatches([]);
    setSelectedMatch(null);
    setAnalysisResult(null);
    setRackImageDimensions({ width: 0, height: 0 });
    setHasAnalyzed(false); // FIXED: Reset analysis flag
    
    if (analysisTimeout.current) {
      clearTimeout(analysisTimeout.current);
    }
  };

  // Handle match selection
  const handleMatchSelect = (matchId: number) => {
    setSelectedMatch(selectedMatch === matchId ? null : matchId);
  };

  // Toggle real-time mode
  const toggleRealTimeMode = () => {
    console.log('Toggling real-time mode from', realTimeMode, 'to', !realTimeMode);
    
    // Clear any pending analysis
    if (analysisTimeout.current) {
      clearTimeout(analysisTimeout.current);
      analysisTimeout.current = undefined;
    }
    
    setRealTimeMode(!realTimeMode);
    setIsAnalyzing(false);
    
    if (!realTimeMode && sareeImage && rackImage) {
      // If enabling real-time and images are present, reset analysis state
      setHasAnalyzed(false);
      setMatches([]);
      setAnalysisResult(null);
      setSelectedMatch(null);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#e91e63" />
      
      <View style={styles.header}>
        <Text style={styles.title}>🥻 Saree Blouse Matcher</Text>
        <Text style={styles.subtitle}>Advanced AI-Powered Color Analysis</Text>
        <Text style={styles.version}>Real-time Color Harmony Detection</Text>
      </View>

      {/* Enhanced Instructions */}
      <View style={styles.instructionSection}>
        <Text style={styles.instructionTitle}>🎨 Advanced Color Matching:</Text>
        <Text style={styles.instructionText}>
          1. Take a clear photo of your saree{'\n'}
          2. Capture the blouse collection at the shop{'\n'}
          3. Get instant AI recommendations using color theory{'\n'}
          4. Analysis includes complementary, analogous & neutral combinations
        </Text>
        
        {/* Real-time mode toggle */}

      </View>
<HarmonyModal
  visible={showHarmonyModal}
  onSelect={handleSelectHarmony}
/>
{/* Show use case description */}
{selectedHarmony && (
  <Text style={styles.useCaseText}>
    {harmonyUseCases[selectedHarmony]}
  </Text>
)}
      {/* Analysis Status */}
      {analysisResult && (
  <View style={styles.analysisStatus}>
    <Text style={styles.statusTitle}>🔬 Last Analysis Results:</Text>
    <Text style={styles.statusText}>
      Processing Time: {analysisResult.processingTime}ms{'\n'}
      Color Harmony: {selectedHarmony ? selectedHarmony.charAt(0).toUpperCase() + selectedHarmony.slice(1) : analysisResult.imageAnalysis.harmony}{'\n'}
    </Text>

    {/* Saree Colors */}
    <Text style={styles.statusText}>Saree Colors:</Text>
    <View style={styles.colorRow}>
      {analysisResult.sareeColors?.map((c, idx) => {
        const match = c.match(/(.*)\s\((#[0-9a-fA-F]{6})\)/); // "Pink (#aabbcc)"
        const label = match ? match[1] : c;
        const hex = match ? match[2] : "#ccc";
        return (
          <View key={`saree-${idx}`} style={[styles.colorChip, { backgroundColor: hex }]}>
            <Text style={[styles.chipText, { color: getTextColor(hex) }]}>{label}</Text>
          </View>
        );
      })}
    </View>

    {/* Blouse Colors */}
    <Text style={styles.statusText}>Blouse Colors:</Text>
    <View style={styles.colorRow}>
      {analysisResult.blouseColors?.map((c, idx) => {
        const match = c.match(/(.*)\s\((#[0-9a-fA-F]{6})\)/);
        const label = match ? match[1] : c;
        const hex = match ? match[2] : "#ccc";
        return (
          <View key={`blouse-${idx}`} style={[styles.colorChip, { backgroundColor: hex }]}>
            <Text style={[styles.chipText, { color: getTextColor(hex) }]}>{label}</Text>
          </View>
        );
      })}
    </View>

      {/* Reasoning */}
<Text style={styles.statusText}>Reasoning:</Text>
{analysisResult.reasoning?.map((r, i) => {
  // Split on HEX codes and keep them as separate tokens
  const parts = r.split(/(#[0-9a-fA-F]{6})/g);

  return (
    <View key={`reason-${i}`} style={styles.reasoningRow}>
      {parts.map((part, idx) => {
        if (/^#[0-9a-fA-F]{6}$/.test(part)) {
          const hex = part;
          const label = nameByHex[hex.toLowerCase()] || hex;
          return (
            <View
              key={`reason-chip-${i}-${idx}`}
              style={[styles.colorChip, { backgroundColor: hex }]}
            >
              <Text style={styles.chipText}>{label}</Text>
            </View>
          );
        }
        // Regular text chunk
        return (
          <Text key={`reason-text-${i}-${idx}`} style={styles.reasonText}>
            {part}
          </Text>
        );
      })}
    </View>
  );
})}

  </View>
)}


      {/* Saree Image Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Your Saree</Text>
        {sareeImage ? (
          <View style={styles.imageContainer}>
            <Image source={{ uri: sareeImage }} style={styles.imagePreview} />
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>✅ Saree Ready</Text>
            </View>
            {realTimeMode && rackImage && !hasAnalyzed && (
              <View style={styles.realTimeIndicator}>
                <Text style={styles.realTimeText}>⚡ Auto-analyzing...</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.placeholderIcon}>🥻</Text>
            <Text style={styles.placeholderText}>Capture Your Beautiful Saree</Text>
            <Text style={styles.placeholderSubtext}>Focus on the main colors and patterns</Text>
          </View>
        )}
        
                  <View style={styles.buttonRow}>
                  {Platform.OS !== 'web' && (
                      <TouchableOpacity
                        style={[
                          styles.button,
                          !hasCameraPermission && styles.disabledButton // gray if disabled
                        ]}
                        onPress={() => takePhoto('saree')}
                        disabled={!hasCameraPermission}
                      >
                        <Text style={styles.buttonText}>📷 Take Photo</Text>
                      </TouchableOpacity>
                    )}
        
                    <TouchableOpacity
                      style={[styles.button, Platform.OS === 'web' && styles.fullWidthButton, !hasLibraryPermission && styles.disabledButton ]}
                      onPress={() => pickImage('saree')}
                      disabled={!hasLibraryPermission}
                    >
            <Text style={styles.buttonText}>
              {Platform.OS === 'web' ? '📁 Select Image' : '🖼️ From Gallery'}
            </Text>
                    </TouchableOpacity>
                  </View>
      </View>

      {/* Blouse Rack Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Blouse Collection</Text>
        {rackImage ? (
          <View style={styles.rackImageContainer}>
            <Image 
              source={{ uri: rackImage }} 
              style={styles.imagePreview}
              onLoad={handleRackImageLoad}
              resizeMode="cover"
            />
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>✅ Collection Ready</Text>
            </View>
            
            {/* Enhanced overlay match markers */}
            <View style={styles.markersOverlay}>
              {matches.map((match, index) => {
                const isSelected = selectedMatch === match.id;
                const markerSize = 50;
                const markerX = (match.x || 0) - markerSize / 2;
                const markerY = (match.y || 0) - markerSize / 2;
                                    // Use bounded coordinates for safe UI placement
                // const markerX = (match.detectedAt?.bounded?.x || 0) - 25;
                // const markerY = (match.detectedAt?.bounded?.y || 0) - 25;
           
                return (
                  <View key={match.id}>
                    
                    <View
                      style={[
                        styles.colorPreview,
                        {
                          left: markerX,
                          top: markerY,
                          backgroundColor: match.hexColor,
                          opacity: isSelected ? 1 : 0.9,
                        },
                      ]}
                    >
                      <Text style={styles.confidenceText}>{match.confidence}%</Text>
                    </View>
                    
                    {isSelected && (
                      <View
                        style={[
                          styles.selectionIndicator,
                          {
                            left: markerX - 5,
                            top: markerY - 5,
                          },
                        ]}
                      />
                    )}
                    
                    {/* Category indicator */}
                    {match.category && isSelected && (
                      <View
                        style={[
                          styles.categoryLabel,
                          {
                            left: markerX - 20,
                            top: markerY + 55,
                          },
                        ]}
                      >
                        <Text style={styles.categoryText}>{match.category}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.placeholderIcon}>👗</Text>
            <Text style={styles.placeholderText}>Capture Blouse Collection</Text>
            <Text style={styles.placeholderSubtext}>Include as many colors as possible</Text>
          </View>
        )}
        
        <View style={styles.buttonRow}>
          {Platform.OS !== 'web' && (
            <TouchableOpacity
                                      style={[
                          styles.button,
                          !hasCameraPermission && { backgroundColor: "#ccc" } // gray if disabled
                        ]}
              disabled={!hasCameraPermission}
              onPress={() => takePhoto('rack')}
            >
              <Text style={styles.buttonText}>📷 Take Photo</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
              style={[styles.button, Platform.OS === 'web' && styles.fullWidthButton, !hasLibraryPermission && styles.disabledButton ]}
              disabled={!hasLibraryPermission}
            onPress={() => pickImage('rack')}
          >
            <Text style={styles.buttonText}>
              {Platform.OS === 'web' ? '📁 Select Image' : '🖼️ From Gallery'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Analysis Section */}
      {!realTimeMode && (
        <View style={styles.section}>
          <TouchableOpacity
            style={[
              styles.analyzeButton, 
              (!sareeImage || !rackImage || isAnalyzing) && styles.disabledButton
            ]}
            onPress={findColorMatches}
            disabled={!sareeImage || !rackImage || isAnalyzing}
          >
            <Text style={styles.analyzeText}>
              {isAnalyzing ? '🤖 AI Analyzing Colors...' : '🎨 Find Perfect Matches'}
            </Text>
            {isAnalyzing && (
              <Text style={styles.analyzingSubtext}>
                Using advanced color theory algorithms...
              </Text>
            )}
          </TouchableOpacity>
          
          {(!sareeImage || !rackImage) && !isAnalyzing && (
            <Text style={styles.helpText}>
              📸 Capture both images to discover perfect color matches
            </Text>
          )}
        </View>
      )}

      {/* Enhanced Results Section */}
      {matches.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✨ Perfect Matches Found!</Text>
          <Text style={styles.resultSubtitle}>
            🎯 Advanced color theory analysis complete - Tap results to explore
          </Text>
          
          <View style={styles.matchesContainer}>
            {matches.map((match, index) => (
              <TouchableOpacity
                key={match.id}
                style={[
                  styles.matchResult, 
                  index === 0 && styles.bestMatch,
                  selectedMatch === match.id && styles.selectedMatch
                ]}
                onPress={() => handleMatchSelect(match.id)}
              >
                <View style={styles.matchHeader}>
                  <View style={styles.rankContainer}>
                    <Text style={styles.matchRank}>
                      {index === 0 ? '🏆' : `${index + 1}`}
                    </Text>
                  </View>
                  
                  <View style={styles.colorIndicator}>
                    <View 
                      style={[styles.colorSwatch, { backgroundColor: match.hexColor }]} 
                    />
                  </View>
                  
                  <View style={styles.matchDetails}>
                    <Text style={styles.matchInfo}>{match.colorName}</Text>
                    {index === 0 && <Text style={styles.bestMatchLabel}>Perfect Match!</Text>}
                    {match.category && (
                      <Text style={styles.categoryInfo}>Category: {match.category}</Text>
                    )}
                    {selectedMatch === match.id && (
                      <View style={styles.selectedDetails}>
                        <Text style={styles.selectedLabel}>👆 See highlighted area above</Text>
                        {match.harmony && (
                          <Text style={styles.harmonyInfo}>Harmony: {match.harmony}</Text>
                        )}
                        {match.complementaryColors && match.complementaryColors.length > 0 && (
                          <View style={styles.complementaryColors}>
                            <Text style={styles.complementaryLabel}>Alt. colors:</Text>
                            <View style={styles.colorRow}>
                              {match.complementaryColors.slice(0, 3).map((color, idx) => (
                                <View 
                                  key={idx}
                                  style={[styles.miniColorSwatch, { backgroundColor: color }]} 
                                />
                              ))}
                            </View>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.confidenceBadge}>
                    <Text style={styles.confidenceScore}>{match.confidence}%</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
          
          <View style={styles.tipContainer}>
            <Text style={styles.tipText}>
              💡 Tip: Higher percentages indicate better color harmony based on color theory
            </Text>
            {analysisResult && (
              <Text style={styles.tipText}>
                🔬 Analysis used {analysisResult.imageAnalysis.dominantColors.length} dominant colors from your saree
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Processing indicator for real-time mode */}
      {realTimeMode && isAnalyzing && (
        <View style={styles.processingIndicator}>
          <Text style={styles.processingText}>🔬 Real-time Analysis in Progress...</Text>
          <Text style={styles.processingSubtext}>Advanced color theory algorithms working</Text>
        </View>
      )}

      {/* Reset Button */}
      {(sareeImage || rackImage) && (
        <TouchableOpacity style={styles.resetButton} onPress={resetApp}>
          <Text style={styles.resetButtonText}>🔄 Try Another Combination</Text>
        </TouchableOpacity>
      )}
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>Made with ❤️ for Indian Fashion Lovers</Text>
        <Text style={styles.footerSubtext}>Powered by Advanced Color Theory & AI</Text>
        {Platform.OS === 'web' && (
          <Text style={styles.webNote}>
            Note: For best experience, use this app on your mobile device
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  header: {
    backgroundColor: '#e91e63',
    padding: 30,
    paddingTop: Platform.OS === 'web' ? 40 : 60,
    alignItems: 'center',
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
    opacity: 0.9,
    textAlign: 'center',
    marginBottom: 5,
  },
  version: {
    fontSize: 12,
    color: 'white',
    opacity: 0.7,
    textAlign: 'center',
  },
  instructionSection: {
    margin: 15,
    backgroundColor: '#e3f2fd',
    borderRadius: 15,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  instructionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 10,
  },
  instructionText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
    marginBottom: 15,
  },
  toggleButton: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#ddd',
    alignSelf: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#4caf50',
    borderColor: '#4caf50',
  },
  toggleButtonText: {
    color: '#666',
    fontSize: 12,
    fontWeight: 'bold',
  },
  toggleButtonTextActive: {
    color: 'white',
  },
  analysisStatus: {
    margin: 15,
    backgroundColor: '#fff3e0',
    borderRadius: 12,
    padding: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f57c00',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#e65100',
    lineHeight: 18,
  },
  section: {
    margin: 15,
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  imageContainer: {
    marginBottom: 15,
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginBottom: 10,
  },
  statusBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },

  realTimeIndicator: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255, 152, 0, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  realTimeText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 10,
  },
  imagePlaceholder: {
    width: '100%',
    height: 220,
    backgroundColor: '#f1f3f4',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: '#dadce0',
  },
  placeholderIcon: {
    fontSize: 50,
    marginBottom: 10,
  },
  placeholderText: {
    color: '#5f6368',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  placeholderSubtext: {
    color: '#9aa0a6',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 5,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  button: {
    backgroundColor: '#1976d2',
    padding: 15,
    borderRadius: 12,
    minWidth: 140,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  fullWidthButton: {
    minWidth: '80%',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  analyzeButton: {
    backgroundColor: '#4caf50',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  disabledButton: {
    backgroundColor: '#9e9e9e',
  },
  analyzeText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  analyzingSubtext: {
    color: 'white',
    fontSize: 12,
    marginTop: 5,
    opacity: 0.8,
  },
  helpText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    marginTop: 15,
    fontStyle: 'italic',
  },
  processingIndicator: {
    margin: 15,
    backgroundColor: '#e8f5e8',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4caf50',
  },
  processingText: {
    color: '#2e7d32',
    fontSize: 16,
    fontWeight: 'bold',
  },
  processingSubtext: {
    color: '#388e3c',
    fontSize: 12,
    marginTop: 5,
  },
  resetButton: {
    backgroundColor: '#f44336',
    padding: 18,
    borderRadius: 12,
    margin: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  resetButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  rackImageContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  markersOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 10,
    pointerEvents: 'box-none',
  },
  matchMarker: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 8,
    zIndex: 100,
  },
  matchNumber: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  colorPreview: {
    position: 'absolute',
    width: 50,
    height: 25,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 6,
    zIndex: 99,
  },
  confidenceText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  selectionIndicator: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#FFD700',
    backgroundColor: 'transparent',
    zIndex: 98,
  },
  categoryLabel: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    zIndex: 97,
  },
  categoryText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  colorIndicator: {
    marginRight: 15,
  },
  colorSwatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  selectedMatch: {
    borderWidth: 3,
    borderColor: '#FFD700',
    backgroundColor: '#fffbf0',
    transform: [{ scale: 1.02 }],
  },
  selectedDetails: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  selectedLabel: {
    fontSize: 11,
    color: '#FF6B35',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  categoryInfo: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    fontStyle: 'italic',
  },
  harmonyInfo: {
    fontSize: 11,
    color: '#4caf50',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  complementaryColors: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  complementaryLabel: {
    fontSize: 10,
    color: '#666',
    marginRight: 8,
  },
  colorRow: {
    flexDirection: 'row',
  flexWrap: 'wrap', // ✅ allow wrapping to next line
  marginVertical: 5,
  },
  miniColorSwatch: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 4,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  resultSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  matchesContainer: {
    marginBottom: 15,
  },
  matchResult: {
    padding: 18,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  bestMatch: {
    backgroundColor: '#e8f5e8',
    borderLeftColor: '#4caf50',
    borderWidth: 2,
    borderColor: '#4caf50',
    transform: [{ scale: 1.02 }],
  },
  matchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankContainer: {
    marginRight: 15,
    alignItems: 'center',
  },
  matchRank: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  matchDetails: {
    flex: 1,
  },
  matchInfo: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  bestMatchLabel: {
    fontSize: 12,
    color: '#4caf50',
    fontWeight: 'bold',
    marginTop: 2,
  },
  confidenceBadge: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 15,
  },
  confidenceScore: {
    fontSize: 12,
    color: 'white',
    fontWeight: 'bold',
  },
  tipContainer: {
    backgroundColor: '#fff3e0',
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#ff9800',
  },
  tipText: {
    fontSize: 13,
    color: '#e65100',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 5,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  footerText: {
    color: '#666',
    fontSize: 12,
    fontStyle: 'italic',
  },
  footerSubtext: {
    color: '#888',
    fontSize: 10,
    marginTop: 4,
  },
  webNote: {
    color: '#999',
    fontSize: 11,
    marginTop: 5,
    textAlign: 'center',
  },
  colorChip: {
  paddingVertical: 6,
  paddingHorizontal: 12,
  borderRadius: 20,
  marginRight: 8,
  marginBottom: 8,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 3,
  elevation: 3,
},

chipText: {
  color: 'white',
  fontWeight: 'bold',
  fontSize: 12,
  textShadowColor: 'rgba(0,0,0,0.5)',
  textShadowOffset: { width: 1, height: 1 },
  textShadowRadius: 2,
},

reasonText: {
  fontSize: 13,
  marginVertical: 2,
  color: '#444',
  fontStyle: 'italic',
},
reasoningRow: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  alignItems: 'center',
  marginBottom: 4,
},
modalContainer: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.5)',
  justifyContent: 'center',
  alignItems: 'center',
},
modalContent: {
  backgroundColor: '#fff',
  padding: 20,
  borderRadius: 16,
  width: '85%',
  alignItems: 'center',
},
modalTitle: {
  fontSize: 20,
  fontWeight: 'bold',
  marginBottom: 8,
},
modalSubtitle: {
  fontSize: 14,
  color: '#555',
  marginBottom: 16,
},
harmonySelector: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  justifyContent: 'center',
  marginBottom: 16,
},
harmonyButton: {
  backgroundColor: '#eee',
  paddingVertical: 8,
  paddingHorizontal: 12,
  borderRadius: 8,
  margin: 5,
},
harmonyButtonActive: {
  backgroundColor: '#4cafef',
},
harmonyButtonText: {
  fontSize: 14,
  color: '#333',
},
confirmButton: {
  backgroundColor: '#4cafef',
  paddingVertical: 10,
  paddingHorizontal: 20,
  borderRadius: 8,
},
confirmText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '600',
},
useCaseText: {
  marginTop: 12,
  fontSize: 14,
  fontStyle: "italic",
  color: "#444",
  textAlign: "center",
}
});

function log(arg0: string, data: any, colors: any) {
  throw new Error("Function not implemented.");
}

