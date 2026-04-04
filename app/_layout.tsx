import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import 'react-native-reanimated';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/constants/onboarding';
import { Colors } from '@/constants/theme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (error) {
          setIsAuthenticated(false);
          return;
        }

        const session = data?.session;

        if (session?.user) {
          const userName = session.user.user_metadata?.name ||
                           session.user.email?.split('@')[0] ||
                           'User';

          await AsyncStorage.setItem('userProfile', JSON.stringify({
            name: userName,
            timezone: 'UTC',
          }));

          if (isMounted) setIsAuthenticated(true);
        } else {
          if (isMounted) setIsAuthenticated(false);
        }
      } catch (error) {
        if (isMounted) setIsAuthenticated(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isAuthenticated === null) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 32, fontWeight: 'bold', letterSpacing: 2, color: Colors.accent }}>
          F.R.I.D.A.Y.
        </Text>
        <Text style={{ fontSize: 14, color: Colors.textSecondary, marginTop: 16 }}>
          Initializing...
        </Text>
      </View>
    );
  }

  if (isAuthenticated === false) {
    return <Redirect href="/auth/login" />;
  }

  return (
    <ThemeProvider value={DarkTheme}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}
