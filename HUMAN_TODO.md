# Actions humaines

(alimenté au fil de l'eau — voir ordre dans le rapport final de PROGRESS.md)

## 1. (fait) Maquettes et validation Docker
`docs/mockups/taskmate.png` est fournie et la CI GitHub exécute la vraie stack (`supabase start`, `test db`, `db lint`, types générés). Rien à faire ; pour rejouer en local avec Docker : `supabase start && supabase db reset && supabase test db`.

## 1bis. Valider le rendu sur appareil
Comparer l'app native aux maquettes (la comparaison automatisée n'a utilisé qu'un rendu web, cf. PROGRESS.md → C3).

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

## 7. Déployer les fonctions et activer l'auth anonyme (projet cloud)
`supabase functions deploy redeem-invite delete-account send-push`. Dashboard → Authentication → Providers : **Anonymous sign-ins activé** (config locale déjà à true),
Email OTP avec le gabarit affichant `{{ .Token }}`. Région du projet : Singapour. `pg_cron` activé (récurrences + expiration des demandes).

## 8. Assets graphiques (placeholders actuels)
Fournir : icône d'app (1024², sans transparence), icône adaptive Android (avant/arrière/monochrome), splash (logo + illustration), avatars des enfants (optionnel : l'app affiche l'initiale dans la couleur du profil).
Déposer dans `apps/mobile/assets/` et mettre à jour `app.json`.

## 9. Politique de confidentialité & stores
Relire/adapter `docs/privacy-policy.md`, l'héberger (URL publique), renseigner `EXPO_PUBLIC_PRIVACY_URL`, puis la saisir dans App Store Connect / Google Play Console.
Fiches stores : catégorie « Famille/Productivité », déclaration de données (e-mail, identifiants d'appareil/push, données d'enfants saisies par le parent), âge cible.
Builds : `eas build --profile production --platform all` puis `eas submit` (comptes Apple Developer / Google Play requis).

## 10. Exécuter les flows E2E Maestro
Voir `apps/mobile/e2e/README.md` (nécessite Docker + build de développement) — non exécutés dans l'environnement de développement automatique.

## 11. Sign-in Apple / Google — voir #4. Valider sur appareils réels : NetInfo/MMKV natifs, caméra QR, notifications locales/push, latence Realtime (< 5 s).

## 12. Web Push (optionnel, lot W3)
1. `node scripts/generate-vapid.mjs` → deux clés. Publique : variable `EXPO_PUBLIC_VAPID_PUBLIC_KEY` (Vercel + `.env`). Privée : `supabase secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:vous@exemple.com`.
2. Appliquer la migration 9 (`supabase db push`) puis `supabase functions deploy send-push` (webhook et récap du soir : voir #6, étapes 3 à 5 ; les étapes EAS/APNs/FCM ne concernent pas la web app).
3. **Limites iOS** : Web Push exige iOS/iPadOS ≥ 16.4 **et** la PWA installée sur l'écran d'accueil (Partager → « Sur l'écran d'accueil ») puis ouverte depuis l'icône ; la demande d'autorisation doit venir d'un tap (bouton des réglages). Dans un onglet Safari, aucune push n'est possible : l'app l'explique à l'utilisateur. Le badge d'icône n'existe aussi qu'en PWA installée.
4. Sans clés VAPID, rien ne casse : le centre de notifications intégré (cloche, compteur, « Cần duyệt ») reste actif ; seul le Web Push est indisponible (« non configuré »).
5. Pas de rappels planifiés « avant l'heure » sur le web (D-035) ; pas de boutons Duyệt/Từ chối dans la notification web (D-034).
