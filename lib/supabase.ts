/**
 * Supabase Client Configuration
 * Shared project with PantryIQ: mtunnqfzryxmiygywqxd
 */

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Fallback values ensure the app works in EAS builds where env vars may not be injected.
// These are public/anon keys — safe to embed in client code.
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://mtunnqfzryxmiygywqxd.supabase.co';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_I11kwLYciuddH_w4jEEIRw_Z4k_WVWe';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
