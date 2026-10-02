import { createClient } from '@supabase/supabase-js';
import { config } from '@/config';
import type { Database } from '@/types/db';
import { supabaseAuthStorage } from './secureStorage';

export const supabase = createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
  auth: {
    storage: supabaseAuthStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
