/**
 * Authentication Service
 * Handles Supabase auth operations for Friday
 */

import { supabase } from './supabase';

export const auth = {
  /**
   * Sign up with email and password
   */
  signUp: async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });
    if (error) throw error;
    return data;
  },

  /**
   * Sign in with email and password
   */
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  /**
   * Sign out current user
   */
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * Get current session
   */
  getSession: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session;
  },

  /**
   * Get current user
   */
  getUser: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  },

  /**
   * Listen to auth state changes
   */
  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    return supabase.auth.onAuthStateChange(callback);
  },

  /**
   * Reset password for email
   */
  resetPassword: async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  },

  /**
   * Update user profile
   */
  updateProfile: async (updates: { name?: string; avatar_uri?: string }) => {
    const { data, error } = await supabase.auth.updateUser({
      data: updates,
    });
    if (error) throw error;
    return data;
  },
};
