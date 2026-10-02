export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'anon-key-not-configured',
  /** Boutons Apple/Google : codés mais désactivés tant que les comptes développeur ne sont pas configurés (HUMAN_TODO). */
  socialAuthEnabled: process.env.EXPO_PUBLIC_SOCIAL_AUTH === '1',
} as const;
