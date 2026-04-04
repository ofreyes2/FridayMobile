/**
 * Sign Up Screen
 * Registration screen for new F.R.I.D.A.Y. users
 */

import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '@/lib/auth';
import { Colors } from '@/constants/theme';

// Password validation requirements
const PASSWORD_REQUIREMENTS = {
  minLength: { regex: /.{8,}/, label: '8+ characters' },
  uppercase: { regex: /[A-Z]/, label: 'Uppercase letter' },
  lowercase: { regex: /[a-z]/, label: 'Lowercase letter' },
  number: { regex: /[0-9]/, label: 'Number' },
  special: { regex: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, label: 'Special character' },
};

export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Calculate password strength
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { strength: 'none', count: 0, met: {} };

    const met: { [key: string]: boolean } = {};
    let count = 0;

    Object.entries(PASSWORD_REQUIREMENTS).forEach(([key, req]) => {
      const isMet = req.regex.test(pwd);
      met[key] = isMet;
      if (isMet) count++;
    });

    if (count === 0) return { strength: 'none', count: 0, met };
    if (count <= 2) return { strength: 'weak', count, met };
    if (count < 5) return { strength: 'fair', count, met };
    return { strength: 'strong', count, met };
  };

  const passwordStrength = getPasswordStrength(password);
  const isPasswordValid = passwordStrength.strength === 'strong';

  const handleSignup = async () => {
    // Validation
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!isPasswordValid) {
      setError('Password does not meet all requirements');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await auth.signUp(email.trim(), password, name.trim());
      console.log('[Signup] User created:', email.trim());

      // Redirect to email verification screen
      router.replace({
        pathname: '/auth/verify',
        params: { email: email.trim() },
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Sign up failed';
      setError(errorMsg);
      console.error('[SignupScreen]', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBackToLogin} disabled={loading}>
              <Text style={styles.backButton}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Create Account</Text>
          </View>

          {/* Form Section */}
          <View style={styles.formSection}>
            {/* Name Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor={Colors.textMuted}
                value={name}
                onChangeText={setName}
                editable={!loading}
                autoCapitalize="words"
              />
            </View>

            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={setEmail}
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
                onChangeText={setPassword}
                editable={!loading}
                secureTextEntry
              />

              {/* Password Strength Indicator */}
              {password && (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthBar}>
                    <View
                      style={[
                        styles.strengthFill,
                        {
                          width: `${(passwordStrength.count / 5) * 100}%`,
                          backgroundColor:
                            passwordStrength.strength === 'weak'
                              ? '#FF6B6B'
                              : passwordStrength.strength === 'fair'
                              ? '#FFD93D'
                              : '#4CAF50',
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.strengthText,
                      {
                        color:
                          passwordStrength.strength === 'weak'
                            ? '#FF6B6B'
                            : passwordStrength.strength === 'fair'
                            ? '#FFD93D'
                            : '#4CAF50',
                      },
                    ]}
                  >
                    {passwordStrength.strength === 'weak'
                      ? 'Weak'
                      : passwordStrength.strength === 'fair'
                      ? 'Fair'
                      : 'Strong'}
                  </Text>
                </View>
              )}

              {/* Requirements Checklist */}
              {password && (
                <View style={styles.requirementsContainer}>
                  {Object.entries(PASSWORD_REQUIREMENTS).map(([key, req]) => (
                    <View key={key} style={styles.requirementItem}>
                      <Text
                        style={[
                          styles.requirementCheck,
                          {
                            color: passwordStrength.met[key] ? '#4CAF50' : '#999',
                          },
                        ]}
                      >
                        {passwordStrength.met[key] ? '✓' : '○'}
                      </Text>
                      <Text
                        style={[
                          styles.requirementLabel,
                          {
                            color: passwordStrength.met[key] ? Colors.textPrimary : Colors.textMuted,
                          },
                        ]}
                      >
                        {req.label}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!loading}
                secureTextEntry
              />
            </View>

            {/* Error Message */}
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Sign Up Button */}
            <TouchableOpacity
              style={[
                styles.signupButton,
                (loading || !isPasswordValid) && styles.buttonDisabled,
              ]}
              onPress={handleSignup}
              disabled={loading || !isPasswordValid}
            >
              {loading ? (
                <ActivityIndicator color={Colors.background} />
              ) : (
                <Text style={styles.signupButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              By signing up, you agree to our Terms of Service and Privacy Policy
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
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 16,
  },
  backButton: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.accent,
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
  },
  formSection: {
    gap: 16,
    marginBottom: 24,
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
  hint: {
    fontSize: 11,
    color: Colors.textMuted,
    fontStyle: 'italic',
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
  signupButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  signupButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  footer: {
    marginTop: 'auto',
  },
  footerText: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
  strengthContainer: {
    gap: 8,
    marginTop: 8,
  },
  strengthBar: {
    height: 4,
    backgroundColor: Colors.surface,
    borderRadius: 2,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '600',
  },
  requirementsContainer: {
    gap: 6,
    marginTop: 12,
    padding: 12,
    backgroundColor: Colors.surface,
    borderRadius: 8,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requirementCheck: {
    fontSize: 14,
    fontWeight: 'bold',
    width: 16,
  },
  requirementLabel: {
    fontSize: 12,
  },
});
