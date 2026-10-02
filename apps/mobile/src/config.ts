export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'anon-key-not-configured',
  /** Boutons Apple/Google : codés mais désactivés tant que les comptes développeur ne sont pas configurés (HUMAN_TODO). */
  /** URL publique de la politique de confidentialité (à héberger — HUMAN_TODO). */
  /** URL publique de la web app (liens d'invitation partageables). Vide : origine du navigateur (web) ou lien natif. */
  webUrl: process.env.EXPO_PUBLIC_WEB_URL ?? '',
  /** Clé VAPID publique (Web Push, optionnel). Générer avec `node scripts/generate-vapid.mjs` ; la clé privée reste côté Supabase (secrets). */
  vapidPublicKey: process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? '',
  privacyPolicyUrl: process.env.EXPO_PUBLIC_PRIVACY_URL ?? '',
  socialAuthEnabled: process.env.EXPO_PUBLIC_SOCIAL_AUTH === '1',
} as const;
