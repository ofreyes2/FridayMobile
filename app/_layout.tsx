import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import 'react-native-reanimated';

import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingScreen from './onboarding';
import { UserProfile } from '@/constants/onboarding';
import { auth } from '@/lib/auth';
import { Colors } from '@/constants/theme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  // Redirect to login if not authenticated
  useEffect(() => {
    if (isAuthenticated === false) {
      console.log('[RootLayout] Redirecting to login...');
      router.replace('/auth/login');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    // Animate pulse while loading
    if (isAuthenticated === null) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [isAuthenticated, pulseAnim]);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      console.log('[RootLayout] Checking Supabase session...');
      const session = await auth.getSession();

      if (session?.user) {
        console.log('[RootLayout] User authenticated:', session.user.email);
        // Save user metadata to AsyncStorage for chat screen
        const userName = session.user.user_metadata?.name ||
                         session.user.email?.split('@')[0] ||
                         'User';
        const profile: UserProfile = {
          name: userName,
          timezone: 'UTC',
        };
        await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
        console.log('[RootLayout] Saved user profile:', profile.name);
        setIsAuthenticated(true);
      } else {
        console.log('[RootLayout] No authenticated user');
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('[RootLayout] Error checking auth status:', error);
      setIsAuthenticated(false);
    }
  };

  const handleOnboardingComplete = (profile: UserProfile) => {
    setShowOnboarding(false);
  };

  // Show loading screen while checking auth
  if (isAuthenticated === null) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <Animated.Text
          style={{
            fontSize: 32,
            fontWeight: 'bold',
            letterSpacing: 2,
            color: Colors.accent,
            opacity: pulseAnim,
          }}
        >
          F.R.I.D.A.Y.
        </Animated.Text>
        <Text style={{ fontSize: 14, color: Colors.textSecondary, marginTop: 16 }}>
          Initializing...
        </Text>
      </View>
    );
  }

  return (
    <ThemeProvider value={DarkTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        {isAuthenticated ? (
          <>
            <Stack.Screen name="(tabs)" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </>
        ) : (
          <Stack.Screen name="auth" options={{ headerShown: false }} />
        )}
      </Stack>
      <StatusBar style="light" />
      {isAuthenticated && (
        <OnboardingScreen visible={showOnboarding} onComplete={handleOnboardingComplete} />
      )}
    </ThemeProvider>
  );
}
