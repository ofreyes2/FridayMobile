import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
    // Listen for auth state changes
    const {
      data: { subscription },
    } = auth.onAuthStateChange((event, session) => {
      console.log('[RootLayout] Auth event:', event);
      setIsAuthenticated(!!session);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const checkAuthStatus = async () => {
    try {
      const session = await auth.getSession();

      if (session?.user) {
        setIsAuthenticated(true);
        console.log('[RootLayout] User authenticated:', session.user.email);
      } else {
        setIsAuthenticated(false);
        console.log('[RootLayout] No authenticated user');
      }

      // Check onboarding status from local storage
      const profileJson = await AsyncStorage.getItem('userProfile');
      if (!profileJson && session?.user) {
        // If user is authenticated but no local profile, show onboarding
        setShowOnboarding(true);
      }
    } catch (error) {
      console.error('[RootLayout] Error checking auth status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOnboardingComplete = (profile: UserProfile) => {
    setShowOnboarding(false);
  };

  if (isLoading) {
    return null;
  }

  return (
    <ThemeProvider value={DarkTheme}>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        {isAuthenticated ? (
          <>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
