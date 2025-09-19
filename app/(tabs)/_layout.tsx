import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import * as ImagePicker from 'expo-image-picker';
import { Tabs } from 'expo-router';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Alert, AppState, AppStateStatus, Linking, Platform } from 'react-native';

// 1. Create context
interface PermissionContextType {
  hasLibraryPermission: boolean | null;
  hasCameraPermission: boolean | null;
}

const PermissionContext = createContext<PermissionContextType>({
  hasLibraryPermission: null,
  hasCameraPermission: null,
});

export const usePermissions = () => useContext(PermissionContext);

// 2. TabLayout component
export default function TabLayout() {
  const colorScheme = useColorScheme();

  const [hasLibraryPermission, setHasLibraryPermission] = useState<boolean | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

  const appState = useRef(AppState.currentState);

  // Request permissions on mount
  useEffect(() => {
    requestPermissions();

    // Listen to app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  // Called whenever app state changes
  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (
      appState.current.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      // App came to foreground, check permissions again
      await checkPermissions();
    }
    appState.current = nextAppState;
  };

  const requestPermissions = async () => {
    if (Platform.OS === 'web') return;
    await checkPermissions(true);
  };

  // Check current permissions
  const checkPermissions = async (showAlertIfDenied: boolean = false) => {
    try {
      const { status: libraryStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();
      const { status: cameraStatus } = await ImagePicker.getCameraPermissionsAsync();

      setHasLibraryPermission(libraryStatus === 'granted');
      setHasCameraPermission(cameraStatus === 'granted');

      if (showAlertIfDenied && (libraryStatus !== 'granted' || cameraStatus !== 'granted')) {
        Alert.alert(
          'Permissions needed',
          'Camera and photo library permissions are required.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }
    } catch (error) {
      console.log('Error checking permissions', error);
    }
  };

  return (
    <PermissionContext.Provider value={{ hasLibraryPermission, hasCameraPermission }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarBackground: TabBarBackground,
          tabBarStyle: Platform.select({ ios: { position: 'absolute' }, default: {} }),
        }}
      >
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Jewlery Match',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="diamond.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="index"
          options={{
            title: 'Saree Match',
            tabBarIcon: ({ color }: { color: string }) => <IconSymbol size={28} name="tshirt" color={color} />,
          }}
        />
      </Tabs>
    </PermissionContext.Provider>
  );
}
