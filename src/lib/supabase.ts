// src/lib/supabase.ts
// Supabase client — credentials loaded from environment variables.
// Local dev:  set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env
// EAS builds: store as EAS Secrets (see .env.example for the commands)

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Hardcoded fallback so the app always works even if .env is missing
const SUPABASE_URL      = process.env.EXPO_PUBLIC_SUPABASE_URL      || 'https://fdbqjzifjkfdbwhlqlxt.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkYnFqemlmamtmZGJ3aGxxbHh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NjY2NzMsImV4cCI6MjA5MTA0MjY3M30.tmxI6cC8mNSYSQPcXIKuoPu8CgAcgdd3jQxEGsyiBKI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export default supabase;
