# Actions humaines (V1 = web app / PWA)

Ce fichier ne garde que ce qui demande **vos comptes**. Tout le reste est fait et vérifié par la CI (jobs `app`, `db`, `e2e`).
L'app mobile native passe en second plan (D-025) : les étapes Apple, Google et EAS ne sont plus nécessaires pour la V1.

## 1. Projet Supabase cloud (région Singapour)
1. Créer le projet (région **Singapore**), noter l'URL, la clé `anon` (publique) et le mot de passe de la base. **Ne jamais** mettre la clé `service_role` dans le front ni dans git.
2. `supabase link --project-ref <ref>` puis `supabase db push` (migrations 1 à 9).
3. Authentication → Providers : **Anonymous sign-ins activé** (session enfant) ; Email activé (OTP) avec le gabarit d'e-mail affichant `{{ .Token }}` ; Authentication → URL Configuration : Site URL = l'URL Vercel (#2).
4. Database → Extensions : activer `pg_cron` (génération des récurrences et expiration des demandes, planifiées par les migrations).
5. Déployer les fonctions : `supabase functions deploy redeem-invite delete-account send-push` (CORS déjà géré pour le navigateur).
6. Notifications push (sans EAS) :
   - `supabase secrets set WEBHOOK_SECRET=<valeur aléatoire>` ;
   - Database → Webhooks → « activity-log-push » : table `public.activity_log`, événement INSERT, type Edge Function → `send-push`, en-tête `x-webhook-secret: <même valeur>` ;
   - récap du soir des parents : planifier (pg_cron + pg_net, ou Scheduled Function) un `POST /functions/v1/send-push` avec `{"type":"evening_recap"}` et le même en-tête (ex. 20:30 Asia/Ho_Chi_Minh = 13:30 UTC).
7. Web Push (optionnel) : `node scripts/generate-vapid.mjs` → publique dans Vercel (`EXPO_PUBLIC_VAPID_PUBLIC_KEY`), privée uniquement ici : `supabase secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:vous@exemple.com`.

## 2. Projet Vercel
1. Importer le dépôt GitHub. **Root Directory : laisser vide (racine du dépôt)** — `vercel.json` à la racine règle tout : installation `pnpm install --frozen-lockfile` depuis la racine du workspace, build `pnpm --filter @taskmate/mobile exec expo export --platform web` (dans `apps/mobile`), sortie `apps/mobile/dist`, réécriture SPA vers `index.html`, service worker sans cache, fichiers hachés en cache long. Framework Preset : « Other ».
2. Branche de production : `main`.
3. Variables d'environnement (Production **et** Preview), toutes **publiques** (elles sont embarquées dans le JavaScript) :

| Variable | Valeur |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL du projet Supabase (https://<ref>.supabase.co) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | clé `anon` du projet (jamais `service_role`) |
| `EXPO_PUBLIC_WEB_URL` | URL publique de l'app (ex. https://taskmate.vercel.app) — liens et QR d'invitation |
| `EXPO_PUBLIC_VAPID_PUBLIC_KEY` | (optionnel) clé VAPID publique du Web Push |
| `EXPO_PUBLIC_PRIVACY_URL` | (optionnel) URL de la politique de confidentialité (`docs/privacy-policy.md` à héberger) |

   Ces variables sont lues au **build** : après modification, redéployer.
4. Après le premier déploiement : reporter l'URL dans Supabase (Site URL, #1.3) et dans `EXPO_PUBLIC_WEB_URL`.

## 3. Limites à connaître (iOS / navigateurs)
- **Installation sur l'écran d'accueil** : iPhone/iPad → Safari → Partager → « Sur l'écran d'accueil » ; Android/Chrome → « Installer l'application ».
- **Web Push sur iOS** : iOS/iPadOS ≥ 16.4 **et** PWA installée puis ouverte depuis l'icône ; l'autorisation se demande depuis le bouton des réglages (geste utilisateur). Dans un onglet Safari, pas de push ni de badge d'icône (l'app l'explique). Sans clés VAPID, le centre de notifications intégré (cloche, compteur, « Cần duyệt ») reste le canal principal.
- Pas de rappels planifiés « avant l'heure » sur le web (D-035) ; pas de boutons Duyệt/Từ chối dans une notification web (D-034).
- Scan QR : caméra du navigateur (HTTPS obligatoire) ; repli = saisie du code ou lien `/join?code=…`.

## 4. À valider sur appareils réels (non automatisable ici)
Installation PWA iOS + Android, scan QR à la caméra, notification Web Push reçue (après #1.7), latence Realtime (< 5 s), rendu iOS Safari. Les tests Playwright (Chromium) couvrent les flux ; ils ne remplacent pas un essai sur téléphone.
