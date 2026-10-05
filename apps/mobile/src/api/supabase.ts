import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { config } from '@/config';
import type { Database } from '@/types/db';
import { supabaseAuthStorage } from './secureStorage';

export const supabase = createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
  auth: {
    storage: supabaseAuthStorage,
    autoRefreshToken: typeof window !== 'undefined', // pas de minuteur pendant le rendu statique (Node)
    persistSession: true,
    // retour de la connexion Google (web) : la session est lue dans l'URL puis l'URL est nettoyée par supabase-js
    detectSessionInUrl: Platform.OS === 'web' && typeof window !== 'undefined',
  },
});
