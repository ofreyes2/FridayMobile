/**
 * Email Verification Screen
 * Shown after signup to prompt user to verify their email
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';

export default function VerifyScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [resending, setResending] = useState(false);
  const [resendConfirm, setResendConfirm] = useState('');
  const [resendError, setResendError] = useState('');

  const handleResendEmail = async () => {
    if (!email) {
      Alert.alert('Error', 'No email address found');
      return;
    }

    setResending(true);
    setResendConfirm('');
    setResendError('');

    try {
      // Make a direct request to Supabase auth endpoint to resend confirmation email
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://mtunnqfzryxmiygywqxd.supabase.co';
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_I11kwLYciuddH_w4jEEIRw_Z4k_WVWe';

      const response = await fetch(`${supabaseUrl}/auth/v1/resend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
        },
        body: JSON.stringify({
          email,
          type: 'signup',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to resend verification email');
      }

      console.log('[Verify] Resent verification email to:', email);
      setResendConfirm('✓ Verification email sent to ' + email);
      // Clear message after 5 seconds
      setTimeout(() => {
        setResendConfirm('');
      }, 5000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to resend email';
      setResendError(errorMsg);
      console.error('[Verify]', errorMsg);
    } finally {
      setResending(false);
    }
  };

  const handleBackToLogin = () => {
    router.replace('/auth/login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Icon Section */}
        <View style={styles.iconSection}>
          <Text style={styles.icon}>✉️</Text>
        </View>

        {/* Content Section */}
        <View style={styles.contentSection}>
          <Text style={styles.title}>Check Your Email</Text>
          <Text style={styles.subtitle}>
            We sent a verification link to
          </Text>
          <Text style={styles.email}>{email}</Text>
          <Text style={styles.description}>
            Click the link in the email to activate your account and log in.
          </Text>

          {/* Resend Confirmation Message */}
          {resendConfirm && (
            <View style={styles.confirmationBox}>
              <Text style={styles.confirmationText}>{resendConfirm}</Text>
            </View>
          )}

          {/* Resend Error Message */}
          {resendError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{resendError}</Text>
            </View>
          )}

          {/* Resend Button */}
          <TouchableOpacity
            style={[styles.resendButton, resending && styles.buttonDisabled]}
            onPress={handleResendEmail}
            disabled={resending}
          >
            {resending ? (
              <ActivityIndicator color={Colors.background} />
            ) : (
              <Text style={styles.resendButtonText}>Resend Verification Email</Text>
            )}
          </TouchableOpacity>

          {/* Back to Login Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackToLogin}
            disabled={resending}
          >
            <Text style={styles.backButtonText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Didn't receive the email? Check your spam folder or resend the verification link.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  iconSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  icon: {
    fontSize: 64,
  },
  contentSection: {
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.accent,
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  confirmationBox: {
    backgroundColor: '#1A5A3A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  confirmationText: {
    fontSize: 13,
    color: '#4CAF50',
    fontWeight: '500',
  },
  errorBox: {
    backgroundColor: Colors.error + '15',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderLeftWidth: 3,
    borderLeftColor: Colors.error,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
  },
  resendButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  resendButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  backButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backButtonText: {
    color: Colors.accent,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  footer: {
    marginTop: 32,
  },
  footerText: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
});
