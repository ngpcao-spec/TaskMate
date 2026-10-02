export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'anon-key-not-configured',
  /** Boutons Apple/Google : codés mais désactivés tant que les comptes développeur ne sont pas configurés (HUMAN_TODO). */
  /** URL publique de la politique de confidentialité (à héberger — HUMAN_TODO). */
  privacyPolicyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL ?? '',
  socialAuthEnabled: process.env.EXPO_PUBLIC_SOCIAL_AUTH === '1',
} as const;
