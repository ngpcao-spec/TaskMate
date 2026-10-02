# Actions humaines

(alimenté au fil de l'eau — voir ordre dans le rapport final de PROGRESS.md)

## 1. Fournir les maquettes
Déposer `docs/mockups/taskmate.png` (non fourni, cf. D-001) pour que l'UI soit recalée.

## 2. Valider la DB avec la vraie stack Supabase (Docker)
Sur une machine avec Docker : `supabase start && supabase db reset && supabase test db && supabase db lint`.
Puis régénérer les types : `supabase gen types typescript --local > apps/mobile/src/types/db.ts`.
(Ici les tests tournent sur Postgres 16 + pgTAP + shim, cf. D-002.)

## 3. Créer le projet Supabase cloud (région Singapour recommandée)
Puis `supabase link` + `supabase db push`, activer `pg_cron` (Database → Extensions) — la migration planifie
`expire-reward-requests` automatiquement si l'extension est disponible. Renseigner `.env` (URL + clé anon uniquement).

## 4. Sign in with Apple / Google
Créer les identifiants (Apple Developer : Services ID + clé ; Google Cloud : client OAuth iOS/Android/Web), les renseigner dans Supabase → Auth → Providers,
installer `expo-apple-authentication` / `@react-native-google-signin/google-signin`, brancher les deux handlers de `app/onboarding/parent-auth.tsx`, puis `EXPO_PUBLIC_SOCIAL_AUTH=1`.

## 5. Déployer l'Edge Function d'invitation
`supabase functions deploy redeem-invite` (après `supabase link`). Activer « Anonymous sign-ins » (Auth → Providers) — requis pour la session enfant.
Personnaliser le template d'e-mail OTP (Auth → Email Templates) pour afficher `{{ .Token }}`.
