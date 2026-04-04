import { useEffect, useState } from 'react'
import { View, Text } from 'react-native'
import { Slot, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Linking from 'expo-linking'
import { supabase } from '@/lib/supabase'
import { UserProfile } from '@/constants/onboarding'
import type { Session } from '@supabase/supabase-js'

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const router = useRouter()
  const segments = useSegments()

  // Handle deep links from email verification
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      // Only handle external auth callback URLs
      // Ignore empty URLs or URLs that don't have auth/callback path
      if (!url || typeof url !== 'string' || url.length === 0 || !url.includes('auth/callback')) {
        return;
      }

      const { path, queryParams } = Linking.parse(url)

      if (path === 'auth/callback') {
        // Extract access token from URL
        const token = queryParams?.access_token as string
        const refreshToken = queryParams?.refresh_token as string

        if (token && refreshToken) {
          try {
            await supabase.auth.setSession({
              access_token: token,
              refresh_token: refreshToken,
            })
            console.log('[RootLayout] Email verified, session restored from deep link')
          } catch (err) {
            console.error('[RootLayout] Failed to restore session from deep link:', err)
          }
        }
      }
    }

    // Check if app was opened via deep link
    Linking.getInitialURL()
      .then((url) => {
        if (url != null) {
          handleDeepLink(url)
        }
      })
      .catch(() => {
        // Ignore errors
      })

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url)
    })

    return () => {
      subscription.remove()
    }
  }, [])

  // Check auth status on mount and listen for changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setIsReady(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  // Handle navigation based on auth state
  useEffect(() => {
    if (!isReady) return

    const inAuthGroup = segments[0] === 'auth'
    const currentRoute = segments.join('/')

    // Only enforce: if no session and not in auth group, redirect to login
    if (!session && !inAuthGroup) {
      console.log('[RootLayout] No session, redirecting to login. Current route:', currentRoute)
      router.replace('/auth/login')
      return
    }

    // When session exists, save user profile (auth screens handle their own nav)
    if (session) {
      const userName = session.user?.user_metadata?.name ||
                       session.user?.email?.split('@')[0] ||
                       'User'
      AsyncStorage.setItem('userProfile', JSON.stringify({
        name: userName,
        timezone: 'UTC',
      }))
    }
  }, [isReady, session, segments, router])

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0F', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#00D4FF', fontSize: 28, fontWeight: 'bold' }}>F.R.I.D.A.Y.</Text>
        <Text style={{ color: '#666', marginTop: 8 }}>Initializing...</Text>
      </View>
    )
  }

  return (
    <>
      <Slot />
      <StatusBar style="light" />
    </>
  )
}
