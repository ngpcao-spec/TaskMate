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

## 6. Notifications push (Expo + Supabase)
1. `eas init` (crée le projet EAS) puis reporter le `projectId` dans `apps/mobile/app.json` → `expo.extra.eas.projectId` (sans lui, le jeton push n'est pas enregistré).
2. iOS : clé APNs ; Android : FCM (`eas credentials`) — requis pour les push réels.
3. `supabase secrets set WEBHOOK_SECRET=<valeur aléatoire>` puis `supabase functions deploy send-push`.
4. Dashboard Supabase → Database → Webhooks → créer « activity-log-push » : table `public.activity_log`, événement INSERT, type « Supabase Edge Function » → `send-push`, en-tête `x-webhook-secret: <même valeur>`.
5. Récap du soir des parents : planifier (pg_cron + pg_net, ou Scheduled Function) un `POST /functions/v1/send-push` avec `{"type":"evening_recap"}` et le même en-tête, à l'heure voulue (ex. 20:30 Asia/Ho_Chi_Minh = 13:30 UTC).
