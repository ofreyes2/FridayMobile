/**
 * Login Screen
 * Professional authentication screen for F.R.I.D.A.Y.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { auth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 300; // 5 minutes in seconds

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetConfirm, setResetConfirm] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockoutTimeRemaining, setLockoutTimeRemaining] = useState(0);
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);

  // Handle lockout timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isLockedOut && lockoutTimeRemaining > 0) {
      interval = setInterval(() => {
        setLockoutTimeRemaining((prev) => {
          if (prev <= 1) {
            setIsLockedOut(false);
            setFailedAttempts(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isLockedOut, lockoutTimeRemaining]);

  const handleLogin = async () => {
    setError('');

    if (isLockedOut) {
      return;
    }

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      return;
    }

    setLoading(true);

    try {
      await auth.signIn(email.trim(), password);
      console.log('[Login] User signed in:', email.trim());
      setFailedAttempts(0);
      setIsLockedOut(false);
      // Use replace to prevent back navigation to login
      router.replace('/(tabs)/chat');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Login failed';

      // Check for email not confirmed error
      if (errorMsg.toLowerCase().includes('email not confirmed') || errorMsg.toLowerCase().includes('email_not_confirmed')) {
        setEmailNotConfirmed(true);
        setError('Please verify your email before signing in. Check your inbox for the verification link.');
      } else {
        setEmailNotConfirmed(false);
        const newFailedAttempts = failedAttempts + 1;
        setFailedAttempts(newFailedAttempts);

        if (newFailedAttempts >= MAX_ATTEMPTS) {
          setIsLockedOut(true);
          setLockoutTimeRemaining(LOCKOUT_DURATION);
          setError('Too many attempts. Try again in 5 minutes');
        } else {
          const remainingAttempts = MAX_ATTEMPTS - newFailedAttempts;
          // Show friendly error message for invalid credentials
          const friendlyMsg = errorMsg.toLowerCase().includes('invalid') ||
                              errorMsg.toLowerCase().includes('credentials')
            ? 'Incorrect email or password'
            : errorMsg;
          setError(`${friendlyMsg}. ${remainingAttempts} attempts remaining`);
        }
      }
      console.log('[LoginScreen]', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your email address');
      return;
    }

    setResendingVerification(true);
    setError('');

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
          email: email.trim(),
          type: 'signup',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to resend verification email');
      }

      console.log('[Login] Verification email resent to:', email.trim());
      setError('✓ Verification email sent to ' + email.trim());
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to send verification email';
      setError('Failed to resend: ' + errorMsg);
      console.log('[ResendVerification]', errorMsg);
    } finally {
      setResendingVerification(false);
    }
  };

  const handleSignUp = () => {
    router.push('/auth/signup');
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your email address to reset your password');
      return;
    }

    setResetLoading(true);
    setResetConfirm('');

    try {
      await supabase.auth.resetPasswordForEmail(email.trim());
      console.log('[Login] Password reset email sent to:', email.trim());
      setResetConfirm('✓ Reset link sent to your email');
      // Clear the confirmation message after 5 seconds
      setTimeout(() => {
        setResetConfirm('');
      }, 5000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to send reset email';
      Alert.alert('Error', errorMsg);
      console.error('[ForgotPassword]', errorMsg);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <Text style={styles.logoIcon}>🤖</Text>
            <Text style={styles.appName}>F.R.I.D.A.Y.</Text>
            <Text style={styles.tagline}>Professional AI Assistant</Text>
          </View>

          {/* Form Section */}
          <View style={styles.formSection}>
            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setError('');
                }}
                editable={!loading}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setError('');
                }}
                editable={!loading}
                secureTextEntry
              />
            </View>

            {/* Error Message */}
            {error && (
              <View style={[styles.errorBox, emailNotConfirmed && styles.verificationErrorBox]}>
                <Text style={[styles.errorText, emailNotConfirmed && styles.verificationErrorText]}>
                  {error}
                </Text>
              </View>
            )}

            {/* Resend Verification Button */}
            {emailNotConfirmed && (
              <TouchableOpacity
                style={[styles.resendButton, resendingVerification && styles.buttonDisabled]}
                onPress={handleResendVerification}
                disabled={resendingVerification}
              >
                {resendingVerification ? (
                  <ActivityIndicator color={Colors.background} />
                ) : (
                  <Text style={styles.resendButtonText}>Resend Verification Email</Text>
                )}
              </TouchableOpacity>
            )}

            {/* Login Button */}
            <TouchableOpacity
              style={[
                styles.loginButton,
                (loading || isLockedOut) && styles.buttonDisabled,
              ]}
              onPress={handleLogin}
              disabled={loading || isLockedOut}
            >
              {loading ? (
                <ActivityIndicator color={Colors.background} />
              ) : isLockedOut ? (
                <Text style={styles.loginButtonText}>
                  Try again in {Math.ceil(lockoutTimeRemaining / 60)}:{(lockoutTimeRemaining % 60).toString().padStart(2, '0')}
                </Text>
              ) : (
                <Text style={styles.loginButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Forgot Password Link */}
            <TouchableOpacity
              onPress={handleForgotPassword}
              disabled={resetLoading}
              style={styles.forgotPasswordContainer}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Reset Confirmation Message */}
            {resetConfirm && (
              <View style={styles.confirmationBox}>
                <Text style={styles.confirmationText}>{resetConfirm}</Text>
              </View>
            )}

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Sign Up Link */}
            <View style={styles.signupSection}>
              <Text style={styles.signupText}>Don&apos;t have an account? </Text>
              <TouchableOpacity onPress={handleSignUp} disabled={loading}>
                <Text style={styles.signupLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By signing in, you agree to our Terms of Service and Privacy Policy
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 2,
    color: Colors.accent,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  formSection: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 16,
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
  loginButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  signupSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  signupLink: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.accent,
  },
  forgotPasswordContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  forgotPasswordText: {
    fontSize: 13,
    color: Colors.accent,
    fontWeight: '500',
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
  footer: {
    marginTop: 32,
  },
  footerText: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
  verificationErrorBox: {
    backgroundColor: '#FFE5E5',
    borderLeftColor: '#FF9800',
  },
  verificationErrorText: {
    color: '#FF9800',
  },
  resendButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  resendButtonText: {
    color: Colors.background,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
