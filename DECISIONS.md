# Décisions

## D-001 — Maquettes absentes
Contexte : `docs/mockups/taskmate.png` n'a pas été fourni (repo vide au démarrage, seuls SPEC.md et le prompt l'ont été).
Décision : on s'appuie sur SPEC.md (§3, §6.2 : tokens, libellés vi). À ajouter par l'humain : le fichier PNG.
Alternatives écartées : s'arrêter.
Réversible : oui — ajuster l'UI quand les maquettes sont disponibles.

## D-002 — pgTAP sur Postgres 16 local, pas `supabase start`
Contexte : l'environnement n'a pas de Docker utilisable (impossible de tirer les images Supabase : registre bloqué). `supabase db reset/test` ne peut donc pas tourner ici.
Décision : les migrations sont du SQL standard Supabase (`supabase/migrations`). Elles sont vérifiées via `scripts/db-test.sh` : cluster Postgres 16 local + extension pgTAP + shim minimal des schémas/rôles Supabase (`auth.users`, `auth.uid()`, rôles `anon`/`authenticated`) dans `scripts/supabase-shim.sql`. La CI GitHub (`ci.yml`) exécute la vraie commande `supabase test db`.
Alternatives écartées : mocker la DB en JS (ne teste pas la RLS).
Réversible : oui — retirer le shim une fois Docker disponible.

## D-003 — Versions : SDK 57, ESLint 9, `expo install` indisponible
Contexte : `expo install` appelle api.expo.dev (bloqué). Les versions ont été prises dans `expo/bundledNativeModules.json`. ESLint 10 est incompatible avec eslint-plugin-react → ESLint 9. TS 6 n'auto-inclut plus les `@types` → `types` explicite dans tsconfig.
Réversible : oui.

## D-004 — Modèle tâche : « deadline » stockée dans `end_time`
Contexte : SPEC §4.2 ne dit pas où stocker « avant HH:MM ».
Décision : `time_kind='deadline'` → `start_time` null, `end_time` = échéance. CHECK de cohérence sur `tasks` et `recurrences`. `points >= 0` (une tâche à 0 point ne crée pas de transaction).
Alternatives écartées : colonne `due_time` dédiée.
Réversible : oui — migration.

## D-005 — Pas de `deleted_at` sur les journaux
Contexte : §4 demande `deleted_at` sur « toutes les tables métier ».
Décision : `point_transactions`, `reward_requests`, `activity_log`, `invite_codes`, `devices` n'en ont pas (journaux immuables / états finis : status, used_at, revoked_at). Les autres tables l'ont. DELETE physique non accordé nulle part.
Réversible : oui.

## D-006 — Un compte = un membership actif ; révocation = `members.revoked_at`
Contexte : §5.8 « un appareil révoqué perd l'accès à sa prochaine requête ».
Décision : index unique partiel sur `members(user_id)` ; tous les helpers RLS (`my_member_id()`…) ignorent les membres révoqués → RLS et RPC refusent immédiatement. `revoke_device` révoque aussi le membre. Re-scanner un nouveau code recrée un membre.
Réversible : oui.

## D-007 — Solde disponible et garde-fous
Décision : `reserved` ne compte que les demandes `pending` non échues (une demande échue ne bloque plus rien avant le passage du cron). `uncomplete_task` débite ce qui a réellement été crédité pour la tâche (somme des transactions liées), pas `points` courant. `adjust_points` refuse si le disponible deviendrait négatif. `request_reward`/`uncomplete_task` verrouillent la ligne `children` pour sérialiser les demandes simultanées.
Réversible : oui.

## D-008 — Les fonctions de solde sont exécutables par `authenticated`
Contexte : l'EXECUTE d'une fonction appelée dans une vue est vérifié sur l'appelant, pas le propriétaire de la vue.
Décision : `child_balance/child_reserved` sont filtrées sur `my_family_id()` → aucune fuite inter-familles (testé).
Réversible : oui.

## D-009 — `supabase db lint` et `gen types` non exécutables ici
Contexte : pas de Docker fonctionnel (D-002).
Décision : `src/types/db.ts` est écrit à la main d'après les migrations (à régénérer avec `supabase gen types typescript --local` quand possible) ; `supabase db lint` tourne en CI. Les migrations sont appliquées proprement sur Postgres 16 nu.
Réversible : oui.

## D-010 — Les tags git ne partent pas sur le remote
Contexte : `git push --tags` renvoie 403 (le proxy n'accepte que la branche de travail). Les tags `m0`, `m1`… sont créés localement ; la branche est poussée.
Réversible : oui — `git push origin --tags` quand c'est autorisé.

## D-011 — Limite de tentatives d'invitation : SQL par utilisateur + Edge Function par IP
Contexte : §5.8 demande 5 tentatives / 15 min via Edge Function. Un `raise exception` annule l'écriture du compteur.
Décision : `redeem_invite` renvoie `null` (au lieu de lever) pour un code invalide, après avoir journalisé l'échec dans `redeem_attempts` ; au-delà de 5 échecs / 15 min (clé = utilisateur, et clé IP optionnelle passée par l'Edge Function) → `too_many_attempts`. L'Edge Function `redeem-invite` reste fine (extrait l'IP, appelle la RPC avec le JWT de l'utilisateur) : la logique est testée en pgTAP.
Alternatives écartées : compteur uniquement dans l'Edge Function (non testable ici, contournable en appelant la RPC).
Réversible : oui.

## D-012 — Confirmation « Bạn là Minh? » après la jointure
Contexte : §2.1 prévoit la confirmation après scan ; consommer le code est irréversible et un aperçu sans consommation créerait un oracle de codes.
Décision : l'écran de confirmation s'affiche juste après `redeem_invite` (le prénom vient du profil enfant) ; pas d'aperçu avant consommation. En cas d'erreur de profil le parent régénère un code (révoque l'ancien appareil).
Réversible : oui — ajouter une RPC `preview_invite` limitée par le même compteur.

## D-013 — Apple / Google : boutons derrière `EXPO_PUBLIC_SOCIAL_AUTH`
Décision : les boutons existent mais sont masqués par défaut ; l'action est un stub tant que les comptes développeur ne sont pas configurés (HUMAN_TODO #4). Le flux réel (OTP e-mail) est opérationnel.
Réversible : oui.

## D-014 — File hors ligne : scope unique `writes`, persistance MMKV, navigation optimiste
Contexte : §6 impose TanStack + MMKV + mutations en pause ; l'ordre des écritures compte (créer avant cocher).
Décision : toutes les mutations d'écriture partagent `scope: {id:'writes'}` → file FIFO globale ; elles sont définies par `setMutationDefaults` (sync/mutations.ts) pour être reprises après redémarrage (seules les mutations en pause sont persistées). Le `tx_id`/`id` est tiré à la création des variables → chaque rejeu (retry, reprise) est idempotent côté RPC. Retry uniquement sur erreurs réseau/5xx (`domain/errors`). Le formulaire revient immédiatement après « Lưu » (écriture optimiste) au lieu d'attendre le serveur. Le cache est purgé si le compte change/déconnexion (`domain/cache-owner`). Realtime : un canal par famille, invalidation de requêtes (pas de patch du cache), re-sync + reprise de la file à chaque (re)connexion.
Alternatives écartées : AsyncStorage (spec = MMKV), un scope par tâche (ne garantit pas création → coche).
Réversible : oui.

## D-015 — Seuils d'encouragement appliqués au taux arrondi
Contexte : §5.4 arrondit le taux puis donne des seuils (≥ 80, 50–79, < 50).
Décision : le message dépend du taux ARRONDI affiché (79,5 % s'affiche 80 % → « Xuất sắc! ») pour rester cohérent avec l'écran.
Réversible : oui (`encouragementFor`).

## D-016 — Push : webhook DB configuré côté Supabase, Edge Function sans état, jetons nettoyés au ticket
Contexte : l'URL de l'Edge Function dépend de l'environnement ; on ne peut pas la figer dans une migration.
Décision : les push partent d'un Database Webhook (INSERT sur `activity_log`) à créer dans le dashboard (HUMAN_TODO) ; l'Edge Function `send-push` est protégée par `x-webhook-secret`. Toute la logique de destinataires/textes est dans `functions/send-push/logic.ts` (pure, testée avec Jest). Les jetons `DeviceNotRegistered` sont effacés dès la réponse des tickets Expo (pas de seconde passe sur les reçus différés). Textes push en vietnamien (langue par défaut ; la langue du destinataire n'est pas stockée). `notification_prefs` : une ligne par membre, RLS « les siennes » ; les préférences activité parent sont lues par l'Edge Function avec la clé service.
Alternatives écartées : trigger SQL + pg_net avec URL en dur ; envoi depuis le client.
Réversible : oui.

## D-017 — Centre de notifications [H]
Décision : la cloche de l'accueil ouvre `/notifications` : parent = `activity_log` récent ; enfant = décisions sur ses demandes d'échange (aucune donnée du frère).
Réversible : oui.

## D-018 — Récurrence : génération horaire idempotente, séries créées/éditées par le parent en ligne
Contexte : §5.3 demande un cron quotidien « à minuit, fuseau de la famille » ; pg_cron s'exécute en UTC et les familles ont des fuseaux différents.
Décision : `generate_all_recurrences()` est planifiée **toutes les heures** (idempotente grâce à `unique(recurrence_id, date)` + `on conflict do nothing`) → chaque famille obtient ses nouvelles occurrences dès son minuit local, sans calcul de fuseau côté cron. Le « aujourd'hui » vient de `family_today()` (fuseau famille). Un trigger AFTER INSERT/UPDATE sur `recurrences` appelle `sync_recurrence` : met à jour/retire/crée les occurrences **futures non faites** (le passé et le fait sont intacts). Les occurrences générées ne déclenchent pas de push `task_assigned`. Créer/modifier/supprimer une série est réservé au parent (RLS) et nécessite le réseau (le serveur génère) ; modifier UNE occurrence reste possible hors ligne. Modifier `child_id` d'une série n'est pas supporté (supprimer + recréer).
Alternatives écartées : cron quotidien à heure fixe UTC (décalé pour certaines familles) ; génération côté client (doublons entre téléphones).
Réversible : oui.

## D-019 — Maquettes disponibles : D-001 caduque
Les maquettes sont dans `docs/mockups/taskmate.png`. L'UI a été alignée (lot C3) ; la spec prime en cas de conflit (pas de comparaison entre enfants, états de validation de la spec v4).

## D-020 — CLI Supabase épinglée en CI
`supabase/setup-cli` utilisait par défaut la 2.20.3, incompatible avec `config.toml`. Version fixée via `SUPABASE_CLI_VERSION` (2.119.0) ; à relever volontairement.

## D-021 — Jest : `gcTime: Infinity` dans le client de test
Les minuteurs de GC de TanStack Query gardaient Jest ouvert. `createTestQueryClient()` (`test-utils/queryClient.ts`) les désactive ; pas de `--forceExit`.

## D-022 — Types DB générés + `models.ts`
`src/types/db.ts` est généré (`supabase gen types`) et contrôlé en CI ; `src/types/models.ts` en dérive des alias (`Tables<>`/`Enums<>`). Remplace D-009.

## D-023 — Validation parentale (spec v4)
États `todo | pending | validated` dérivés de `completed_at`/`validated_at` ; l'enfant n'a plus d'écriture directe sur `tasks` ; RPC `complete_task`/`uncomplete_task`/`validate_task`/`reject_task` verrouillées `FOR UPDATE`, raisons `task_validated`/`task_unvalidated` ; données existantes cochées avec points ⇒ validées. Aucun crédit optimiste côté enfant.

## D-024 — Comparaison visuelle par rendu web
Faute de simulateur, l'app est exportée en web et photographiée (Playwright + Chromium préinstallé) contre un faux serveur PostgREST (`tools/visual`). Limite : rendu non natif. Les pastilles enfants ont été retirées du calendrier et des statistiques (spec : pas de comparaison entre enfants).

## D-025 — Web = cible principale ; mobile natif en second plan
La V1 est une PWA hébergée sur Vercel. L'app native reste fonctionnelle (mêmes sources, tests Jest, `expo export --platform ios` en CI) mais n'est plus prioritaire : Apple/Google/EAS sortent de HUMAN_TODO.

## D-026 — Implémentations web par fichiers `.web.ts(x)`
Metro choisit `X.web.ts` sur le web : `sync/storage.web.ts` (localStorage + repli mémoire si refusé/quota), `sync/network.web.ts` (`navigator.onLine`, `online`/`offline`, `visibilitychange`), `api/secureStorage.web.ts` (session Supabase dans localStorage), `services/notifications.web.ts` (no-op + même mapping d'actions), `components/QrScanner.web.tsx`, `pwa/registerServiceWorker.web.ts`. localStorage plutôt qu'IndexedDB : le persister TanStack et la file de mutations exigent un stockage **synchrone** ; le quota (~5 Mo) couvre largement le cache d'une famille, et le repli mémoire évite tout plantage.

## D-027 — Scan QR web : getUserMedia + jsQR
`BarcodeDetector` est absent de Firefox et Safari ; `jsqr` (JS pur) décode les images du flux vidéo sur tous les navigateurs. Caméra refusée/absente → message, la saisie manuelle du code reste sur l'écran de jointure.

## D-028 — Export web et PWA (sortie amendée par D-029)
`expo export --platform web` → `apps/mobile/dist` (SPA : un seul index.html). PWA : `public/manifest.webmanifest`, icônes placeholders générées depuis `assets/icon.png` (192/512/maskable/apple-touch), `app/+html.tsx` (meta iOS/Android, focus visible), service worker `public/sw.js` : cache d'abord pour les fichiers hachés (`/_expo/static`, `/assets`, `/icons`), réseau d'abord avec repli sur la coquille pour les navigations, **jamais** l'API Supabase (autre origine). La file d'écritures hors ligne et son idempotence (tx_id fixé à la création) sont inchangées ; elles utilisent le stockage web.
Limite connue : `expo export` affiche « Something prevented Expo from exiting » (handle ouvert pendant le rendu statique, code retour 0) — sans conséquence pour le build.

## D-029 — Export web `single` (remplace `static` de D-028) + gabarit `public/index.html`
Le rendu statique d'Expo Router pré-rend chaque route sans session : mismatch d'hydratation React (#418) sur l'écran d'accueil, et le CLI ne se terminait pas seul. L'app étant entièrement pilotée par la session (aucun contenu public à référencer), on passe à `web.output = "single"` : un seul `index.html`, aucune erreur d'hydratation, plus de message « prevented Expo from exiting ». Les balises PWA (manifest, apple-touch-icon, meta iOS, focus visible) sont dans `apps/mobile/public/index.html` (gabarit Expo), `+html.tsx` supprimé. Les liens profonds (`/join?code=…`) passent par la réécriture SPA vers `index.html` (Vercel, lot W4).

## D-030 — Mise en page responsive (seuil 900 px)
`useIsWide()` (`hooks/useLayout.ts`). ≥ 900 px : navigation latérale (`tabBarPosition: 'left'`, variante `material`), file « Cần duyệt » en deux colonnes Tâches | Récompenses ; en dessous : onglets du bas et onglets Tâches/Récompenses. Contenu centré (`Screen`, max 760 px ; 1100 px pour les écrans à colonnes). Mobile-first conservé.

## D-031 — Confirmations multiplateformes
`Alert.alert` est un no-op sur react-native-web : toutes les confirmations (suppression d'enfant/de compte, révocation d'appareil, « Duyệt tất cả », demande d'échange) passent par `components/confirm.ts` (Alert natif) / `confirm.web.ts` (`window.confirm`).

## D-032 — Liens d'invitation web
Lien partageable `https://<origine>/join?code=XXXXXX` (origine = `EXPO_PUBLIC_WEB_URL`, sinon `window.location.origin`, sinon lien natif `taskmate://`). Le QR encode ce lien ; `parseInviteLink` lit liens natifs, liens web et codes bruts. Partage : `navigator.share` sinon presse-papiers (web), `Share.share` (natif).

## D-033 — Centre de notifications intégré = canal principal sur le web
Cloche avec compteur de non lues (journal d'activité pour le parent, décisions sur les demandes pour l'enfant), carte « N mục chờ duyệt » en tête du centre, badge « Cần duyệt » sur l'onglet/menu latéral, badge d'icône de la PWA (`navigator.setAppBadge`) et titre d'onglet `(n) TaskMate`. « Non lu » = plus récent que le dernier passage dans le centre, stocké localement par membre (`store/notificationSeen.ts`) ; à la première ouverture sur un appareil l'historique est considéré comme lu. Le centre se rafraîchit via Realtime (tâches, demandes, points → invalidation de `['activity']`).

## D-034 — Web Push optionnel (VAPID)
Migration 9 : `devices.platform` accepte `web`, colonne `web_push_subscription` (jsonb validé : endpoint HTTPS + clés), RPC `register_web_push` / `unregister_web_push` (pas d'écriture directe ; un navigateur = un appareil actif, réattribué si le compte change). pgTAP `10_web_push` (positifs et négatifs). Le client s'abonne via `PushManager.subscribe` avec `EXPO_PUBLIC_VAPID_PUBLIC_KEY` depuis un geste utilisateur (réglages → « Notifications du navigateur »). `send-push` envoie en plus via `npm:web-push` si `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` sont définis (sinon ignoré) ; mêmes destinataires, préférences et textes que le mobile ; abonnements 404/410 révoqués. Le service worker (`public/sw-push.js`) affiche la notification et ouvre la page utile au clic : **pas de boutons Duyệt/Từ chối dans la notification web** (le service worker n'a pas de session) — la décision se prend dans l'app.

## D-035 — Pas de rappels locaux planifiés sur le web
Les rappels « 10 min avant » de l'enfant reposent sur des notifications locales planifiées, impossibles dans un navigateur sans push serveur. Sur le web : centre de notifications + Web Push d'activité ; les rappels planifiés restent natifs. Limite documentée dans HUMAN_TODO.

## D-036 — Clés VAPID
`scripts/generate-vapid.mjs` génère la paire. Publique : variable `EXPO_PUBLIC_VAPID_PUBLIC_KEY` (front). Privée : uniquement secrets Supabase. Jamais committées.

## D-037 — CORS sur les Edge Functions appelées par le navigateur
`redeem-invite` et `delete-account` n'avaient aucun traitement CORS (inutile en natif) : un navigateur aurait été bloqué au préflight OPTIONS. `supabase/functions/_shared/cors.ts` répond au préflight (204) et ajoute les en-têtes à toutes les réponses (`Access-Control-Allow-Origin: *` : l'accès repose sur le JWT, pas sur des cookies). Test Jest `edge-cors`. `send-push` (serveur → serveur) est inchangée.

## D-038 — Playwright remplace Maestro
Dossier `apps/mobile/e2e-web/`, Chromium, app exportée servie par `support/serve.mjs` (même logique de réécriture SPA que Vercel). Chaque test crée sa famille avec la clé de service du Supabase **local** (`support/seed.ts`) et ouvre les sessions en les injectant dans le localStorage (même clé que supabase-js) ; l'onboarding OTP par e-mail n'est pas rejoué (couvert par les tests Jest/pgTAP). Job CI `e2e` : `supabase start` + `supabase functions serve` (jointure par lien) + build web contre le local. Les flows Maestro sont supprimés (D-025).

## D-039 — Vercel : Root Directory vide, tout dans `vercel.json`
Un `vercel.json` ne peut pas fixer le « Root Directory ». On le laisse vide (racine du dépôt) : `installCommand` exécuté depuis la racine du workspace pnpm, `buildCommand` ciblant `apps/mobile` via `--filter`, `outputDirectory: apps/mobile/dist`. Réécriture SPA, en-têtes de cache (sw.js/index.html/manifest sans cache ; `/_expo/static` et `/assets` immutables un an), `Permissions-Policy: camera=(self)` pour le scan QR. Configuration validée avec `@vercel/routing-utils` (celui de Vercel) et testée (`vercel-config.test.ts`) ; build vérifié en local, rien déployé.

## D-040 — PR empilées W1 → W2 → W3 → W4
Chaque lot dépend du précédent (non fusionné, pas de fusion par moi) : chaque branche part du lot précédent et sa PR cible la branche précédente. Après fusion de W1 dans `main`, GitHub repointe la PR W2 sur `main`, etc. Fusionner dans l'ordre W1, W2, W3, W4.

## D-041 — États d'accessibilité exposés au web (`aria-*`)
`react-native-web` 0.21 n'utilise `accessibilityState` que pour `disabled` : cases cochées, onglets/pastilles sélectionnés, puces, chevrons déroulés et boutons occupés n'étaient pas annoncés aux lecteurs d'écran (découvert par les tests Playwright : `toBeChecked` voyait toujours « décoché »). Les composants concernés ajoutent `aria-checked` / `aria-selected` / `aria-expanded` / `aria-busy` en plus de `accessibilityState` (conservé pour le natif).

## D-042 — Projet Supabase de production en région Sydney (ap-southeast-2), pas Singapour
Le projet cloud existe : https://olftkozksanvnzlsvwrp.supabase.co, région **Sydney**. HUMAN_TODO et les décisions précédentes parlaient de Singapour (plus proche du Vietnam) : sans conséquence fonctionnelle, seulement une latence un peu plus élevée. Rien n'est changé ; migrer vers Singapour supposerait un nouveau projet et la restauration des données. Hébergement web : Vercel, projet `taskmate`, https://taskmate-rho-nine.vercel.app (branche de production `main`).

## D-043 — Intégration GitHub de Supabase : ce qu'elle fait (doc lue le 2026-10-03)
Source : documentation officielle « GitHub integration » (dépôt supabase/supabase). Répertoire de travail = dossier PARENT de `supabase/` → ici `.` (le dossier `supabase/` est à la racine : aucune restructuration nécessaire). Avec l'option **Deploy to production**, un push/une fusion sur la branche de production : (1) applique les **nouvelles** migrations de `supabase/migrations` dans l'ordre des horodatages (chacune dans une transaction ; pas de `create index concurrently`, aucune dans nos fichiers) ; (2) déploie les Edge Functions **déclarées dans `config.toml`** (nos trois le sont) ; (3) déploie les buckets Storage déclarés. **Ignorés** : `seed.sql` en production, la configuration Auth/API (donc : connexions anonymes, Site URL, gabarits d'e-mail se règlent à la main dans le Dashboard), et les **secrets** des Edge Functions (Dashboard → Edge Functions → Secrets). Les 10 migrations s'appliquent donc toutes seules dès la première fusion sur `main` — **à condition que l'intégration soit active avant** (HUMAN_TODO : étape 4 avant les fusions). Les PR étant empilées, chaque branche doit être supprimée après fusion pour que la suivante cible `main` ; Plan B documenté (re-déclenchement par un commit touchant `supabase/`, ou application manuelle dans le SQL Editor + enregistrement dans `supabase_migrations.schema_migrations`).

## D-044 — Migrations durcies pour Supabase cloud
Une migration qui échoue bloque tout le déploiement. Risque identifié : `pg_cron` (extension à activer, créée par un autre rôle selon la méthode, docs : `create extension pg_cron with schema pg_catalog`). Les migrations 2 et 6 (jamais appliquées sur une base de production vierge, donc modifiables sans conséquence) planifient maintenant les tâches dans un bloc **non bloquant** (échec = `warning`, pas d'erreur). Migration 10 : `schedule_cron_jobs()` (rattrapage idempotent, réservée aux rôles de la base) et `diagnostics()`. Publication Realtime et extensions : déjà gardées/idempotentes (migration 4 teste l'existence de `supabase_realtime`). Vérifié par pgTAP `11_diagnostics` (tâches cron et publication présentes sur la vraie image Supabase de la CI, RLS activée partout, droits).

## D-045 — Écran Réglages → Diagnostic
RPC `diagnostics()` (parents uniquement ; ne renvoie que des NOMS : tables, fonctions, extensions, publication Realtime, tâches cron, tables sans RLS) + sondes côté navigateur : `GET /auth/v1/settings` (champ `external.anonymous_users` : lit l'état sans créer d'utilisateur), websocket Realtime, présence des 3 Edge Functions par `GET` (404 = absente ; **jamais** de POST : `delete-account` supprime la famille). Listes attendues dérivées des types générés avec une garde de complétude à la compilation. Textes **toujours en français** (outil d'exploitation du propriétaire). L'exécution réelle dans un navigateur a révélé 3 défauts corrigés avec tests : récursion infinie `removeChannel` ↔ statut `CLOSED`, sonde sans délai, réponse mal formée qui plantait l'écran.

## D-046 — Clés VAPID générées dans le navigateur
Pour éviter d'installer Node : Réglages → Diagnostic → « Générer des clés Web Push » (WebCrypto, rien n'est stocké ni envoyé). Pas de workflow GitHub qui afficherait la clé privée dans des journaux publics (dépôt public).

## D-047 — Déploiement des Edge Functions : intégration d'abord, workflow manuel en repli
Méthode principale : l'intégration GitHub (D-043), aucun outil à installer. Repli : `.github/workflows/deploy-functions.yml` (`workflow_dispatch` uniquement, secret GitHub `SUPABASE_ACCESS_TOKEN`). Les secrets des fonctions (WEBHOOK_SECRET, VAPID_*) se saisissent dans le Dashboard.

## D-048 — Comptes e-mail/mot de passe (parents) et identifiant/mot de passe (enfants) ; fin des invitations
Changement de produit : plus de code d'invitation, QR, lien, OTP ni connexion anonyme. **Parent** : un écran e-mail + mot de passe (≥ 8, contrôlé côté client uniquement car le minimum GoTrue doit rester ≤ 6 pour les enfants), « Créer un compte » (`signUp`) / « Se connecter » (`signInWithPassword`) ; « Confirm email » doit être OFF (sinon `signUp` ne renvoie pas de session et l'app l'explique ; le diagnostic le détecte via `mailer_autoconfirm`). **Enfant** : le parent crée le compte dans l'app (identifiant 3-30 car. `[a-z0-9._-]`, mot de passe ≥ 6), peut le changer ou le supprimer ; l'enfant se connecte avec identifiant + mot de passe, sur son propre téléphone.
- **Edge Functions** `create-child`, `reset-child-password`, `delete-child` (`verify_jwt = true`) : la clé `service_role` vient uniquement de l'environnement des fonctions (jamais dans le code, git ou le client). L'autorisation est revérifiée côté serveur : la RPC `child_account_target` est exécutée **avec le JWT de l'appelant** et refuse (42501 → 403 `forbidden`) tout appelant qui n'est pas parent de la famille de l'enfant ; un enfant ne peut donc appeler aucune des trois.
- **E-mail interne fictif** `<identifiant>@child.taskmate.invalid` (domaine réservé RFC 2606, jamais affiché ni utilisé pour envoyer) : déterministe, donc la connexion enfant n'exige aucun appel serveur ; l'identifiant est un espace de noms global (unicité garantie par GoTrue ET par un index unique SQL) ; « identifiant déjà pris » est géré (409 `identifier_taken`). Les comptes enfants portent `app_metadata.account_type = 'child'` (non modifiable par l'utilisateur) : `create_family` les refuse.
- **Table `child_accounts`** (RLS : lecture réservée aux parents de la famille ; aucune écriture directe) ; écritures via `register_child_account` / `remove_child_account`, réservées à `service_role`. pgTAP positifs et négatifs (`12_child_accounts.test.sql`), dont « un enfant ne peut pas créer, modifier ni supprimer un compte ».
- **Suppression** : le compte auth est verrouillé (e-mail remplacé par un jeton inutilisable, mot de passe aléatoire, bannissement) puis le membre est révoqué — `members.user_id` référence `auth.users`, donc pas de suppression physique ; l'identifiant est libéré, l'historique (tâches, points) reste attaché au profil. Supprimer le profil entier (`deleteProfile`) retire aussi l'enfant.
- **Retiré** : `redeem-invite`, `create_invite`, `redeem_invite`, tables `invite_codes` et `redeem_attempts`, écrans de jointure, lien `/join`, scanner QR, partage, dépendances `expo-camera`, `jsqr`, `react-native-qrcode-svg`, permission caméra, `EXPO_PUBLIC_SOCIAL_AUTH`, connexions anonymes. Droits RLS enfant/parent de la spec v4 inchangés. Nouvelle migration `20260702000011_child_accounts.sql` (les anciennes ne sont pas réécrites). Un second parent n'a plus de mécanisme d'invitation (hors périmètre de ce changement).

## D-049 — Ajouter un enfant après l'onboarding, et gérer ses accès (parent uniquement)
- **Entrée** : Hồ sơ affiche une carte sélectionnable par enfant (inchangé : change l'enfant affiché sur Hôm nay, Lịch, Thống kê) + une carte « Thêm con » **réservée au parent** ; Cài đặt chung → Gérer les profils enfants reçoit le même bouton. Écran `more/add-child` : route protégée comme `task/new` (un enfant est redirigé vers `/`, le formulaire n'est jamais rendu ; la sécurité réelle reste côté serveur : RLS sur `children`, Edge Function `create-child` qui revérifie le parent).
- **Formulaire commun** (`ChildProfileFields` : prénom, date de naissance, couleur) partagé avec l'onboarding ; s'y ajoutent identifiant et mot de passe (≥ 6). Pas d'étiquette « aîné/cadet » pour les enfants ajoutés (aucun classement entre enfants).
- **Atomicité** : `addChildWithAccount` crée le profil puis appelle `create-child` ; si le compte est refusé (identifiant déjà pris, mot de passe), le profil est retiré (`delete-child` avec `deleteProfile`) : pas d'enfant fantôme sans accès. Le formulaire garde la saisie et affiche « identifiant déjà pris ».
- **Accès affichés une fois** : identifiant + mot de passe en clair, uniquement dans l'état local de l'écran juste après la création (jamais stockés ni journalisés) ; bouton de copie (`expo-clipboard`, natif et web) et avertissement qu'ils ne seront plus affichés (un nouveau mot de passe se définit dans Gérer les profils). Dépendance ajoutée : `expo-clipboard`.
- **Gestion par enfant** (déjà fournie par `ChildAccountSection`) : changer le mot de passe (`reset-child-password`), supprimer le compte ou le profil (`delete-child`), créer le compte d'un profil sans accès.
- **Tâches** : « Pour qui ? » apparaît dès qu'il y a plusieurs enfants (3e inclus), l'enfant affiché est coché par défaut. Aucun écran ne compare ni ne classe les enfants.

## D-050 — Parents connectés avec Google, plusieurs parents par famille, enfants rattachés à la famille
Refonte des comptes (migration `20260702000012_google_parents_family_child_login.sql`, droits RLS enfant/parent de la spec v4 inchangés) :
- **Parents = Google.** Bouton principal « Continuer avec Google » (`signInWithOAuth`, provider `google`, `redirectTo` = URL du site ; `detectSessionInUrl` activé sur le web). L'e-mail est vérifié par Google ; sans connexion, aucun accès à une famille ni à des données (RLS). La connexion e-mail + mot de passe reste pour les comptes existants, **sans bouton d'inscription**. Appliqué CÔTÉ BASE : `create_family` et `join_family_with_code` exigent `is_google_account()` (fournisseur `google` dans `app_metadata`, non modifiable par l'utilisateur) → un compte e-mail ordinaire reçoit `google_required`, même en appelant l'API directement. (Couper l'inscription e-mail dans GoTrue n'est pas possible seul : `[auth.email] enable_signup = false` désactive aussi les CONNEXIONS e-mail, constaté en CI — « Email logins are disabled » — donc le réglage reste à true.) Natif : Google « disponible sur le web » (pas de retour d'OAuth natif, cible web D-025).
- **Plusieurs parents.** Table `parent_invites` (RLS : lecture parents de la famille, **sans** la colonne `code_hash` ; aucune écriture directe). `create_parent_invite()` : code de 8 caractères (alphabet sans ambiguïté, 40 bits, tirage uniforme), **haché sha256**, 24 h, usage unique, une seule invitation active par famille (régénérer annule la précédente), clair renvoyé UNE fois et jamais relisible ; `revoke_parent_invite()` ; `join_family_with_code(code, prénom)` renvoie NULL pour tout code faux/expiré/utilisé/annulé (message unique), journalise l'échec (`auth_attempts`) et verrouille après **5 échecs / 15 min par compte** (`too_many_attempts`, même avec le bon code) ; refus pour un compte enfant, non-Google ou déjà membre. Tous les parents voient les mêmes enfants, tâches, récompenses et valident (RLS par famille inchangée). `leave_family()` : un parent part ; le dernier ne peut partir qu'en supprimant la famille (`last_parent`). Le code haché n'est pas poivré (40 bits + 5 essais/15 min/compte + 24 h : l'attaque en ligne est le vrai risque, pas la fuite de la base).
- **Enfants rattachés à la famille.** L'identifiant n'est unique que **dans la famille** (index `(family_id, login_id)`). L'adresse d'authentification interne (`child_accounts.auth_email`, jamais lisible côté client) est `<identifiant>.<famille>@child.taskmate.invalid` pour les nouveaux comptes (globalement unique, jamais utilisée pour écrire).
- **Connexion enfant** : e-mail d'un parent de la famille + identifiant + mot de passe → Edge Function **`child-login`** (`verify_jwt = false`, publique par nature). La clé `service_role` (environnement des fonctions, jamais dans le code/git/client) ne sert qu'aux RPC `child_login_prepare` / `child_login_record_failure` (service_role seulement) ; la session vient de GoTrue (`signInWithPassword`), jamais fabriquée. **Réponse d'échec unique** (401 `invalid_credentials`) quel que soit le champ faux ou manquant (aucune énumération d'e-mails) ; **verrouillage temporaire** 15 min : 10 échecs par IP, 20 échecs par famille (ou par e-mail inconnu, **haché**, même seuil → pas de signal d'existence), décidé AVANT toute vérification de mot de passe (429 `too_many_attempts`). L'IP vient de `cf-connecting-ip`, sinon du premier `x-forwarded-for` (falsifiable : le verrou par famille est le garde-fou) ; seules des empreintes (sha256) sont journalisées. Limite connue : le temps de réponse d'un e-mail inconnu peut différer (le calcul bcrypt, lui, est à coût constant depuis D-051) ; GoTrue garde ses propres limites de débit.
- **Migration de données.** Les comptes enfants existants gardent leur adresse (`<identifiant>@child.taskmate.invalid`, copiée dans `auth_email`) : ils se connectent avec le nouveau formulaire sans rien refaire (testé par `scripts/db-migration-test.sh`, exécuté par `scripts/db-test.sh`). Limite levée par D-051 (adresses anciennes devinables, acceptées directement par GoTrue).
- **Retiré** : inscription e-mail/mot de passe (`signUpParent`), vérification « Confirm email » du diagnostic (remplacée par « Connexion Google », `external.google`), `loginEmail` côté client, unicité globale des identifiants. **Diagnostic** : nouvelles tables/RPC/fonction `child-login`.
- **Récurrence** : « T5 » (jeudi) est bien enregistré en ISO 4 et les occurrences tombent un jeudi, en jour local de la famille (Asia/Ho_Chi_Minh), quel que soit le fuseau de la session — aucun décalage réel ; verrouillé par `15_recurrence_weekday.test.sql` (dates fixes, minuit local, sessions Los Angeles/Auckland) et des tests Jest (`calendar`, `TaskForm`).

## D-051 — Comptes enfants : plus aucune connexion directe, `child-login` est la seule porte
**Faille fermée.** Avant : l'adresse GoTrue d'un compte enfant (`<identifiant>@child.taskmate.invalid`) était devinable et `signInWithPassword` acceptait le mot de passe de l'enfant → le verrou anti-essais de `child-login` (IP / famille) était contournable. Même après D-050, un compte « nouveau » (`<identifiant>.<famille>@…`) restait dérivable.
**Solution (migration `20260702000013_child_auth_hardening.sql` + Edge Functions) : séparer le secret de GoTrue.**
- Le mot de passe de l'enfant n'est **plus connu de GoTrue**. Il est stocké comme **haché bcrypt** (`child_accounts.password_hash`, pgcrypto ; colonne hors des grants SELECT : illisible pour tout rôle applicatif, parents compris) et vérifié par la RPC `child_login_check_password` (service_role, **coût constant** : un compte inconnu subit aussi un calcul bcrypt). Le compte GoTrue a une adresse **UUID aléatoire** et un mot de passe **aléatoire inconnu de tous** (jamais stocké ni journalisé).
- `child-login` : verrou IP/famille → résolution (e-mail parent + identifiant) → vérification du haché → **seulement alors** émission de la session par GoTrue pour l'adresse interne (`admin.generateLink` de type magiclink — aucun e-mail envoyé — échangé aussitôt par `verifyOtp`). Un échec de mot de passe est journalisé comme avant (réponse unique 401) ; un échec d'émission est une erreur 500, pas un échec d'identification. Il n'existe donc aucune autre porte d'entrée : l'adresse interne seule n'ouvre rien, même devinée.
- `create-child` crée le compte GoTrue avec une adresse UUID et un mot de passe aléatoire, et enregistre le haché du vrai mot de passe (`register_child_account`, 5 arguments). `reset-child-password` change le haché (`set_child_password`) ; GoTrue n'est pas touché.
- **Migration des comptes existants** (`migrate_legacy_child_accounts()`, appelée une fois à la fin de la migration, rejouable, service_role seulement — pas de clé, pas de commande manuelle) : copie le bcrypt de GoTrue dans `password_hash` (**le même mot de passe continue de fonctionner**, vérifié par pgTAP, par `scripts/db-migration-test.sh` et par l'E2E), remplace l'adresse (`auth.users` + identité e-mail, `provider_id` = id utilisateur inchangé) par un UUID, remplace le mot de passe GoTrue par un secret aléatoire. Identifiant visible, membre, profil, tâches et points : intacts. Vérifié en production (lecture seule) : l'utilisateur `postgres` peut modifier `auth.users` / `auth.identities`, pgcrypto est installé (`extensions`), les 4 comptes existants ont un bcrypt, leurs identités ont `provider_id` = id utilisateur.
- **Autres portes de GoTrue** : lien magique / réinitialisation de mot de passe pour ces adresses partent vers le domaine réservé `.invalid` (RFC 2606), jamais livrable, et l'adresse est un UUID inconnu ; pas d'OAuth ni d'anonyme pour ces comptes.
- **Fenêtre de déploiement** : l'intégration GitHub applique la migration puis déploie les fonctions. Entre les deux (quelques secondes à minutes), l'ANCIENNE `child-login` (qui faisait `signInWithPassword`) échoue pour les comptes migrés ; elle redevient correcte au déploiement de la nouvelle. Si le déploiement des fonctions échouait, les enfants ne pourraient plus se connecter tant qu'il n'est pas relancé (Plan B de HUMAN_TODO) — leurs données ne sont pas touchées.
- **Tests** : pgTAP `16_child_auth_hardening` (migration, même mot de passe via le haché, ancien mot de passe sans effet sur GoTrue, droits, haché illisible, coût/forme, rejouable) ; Jest (flux `child-login` : aucune session sans haché valide, 500 distincts) ; E2E sur le VRAI GoTrue : un ancien compte (adresse devinable + mot de passe connu de GoTrue — la connexion directe réussit AVANT) est migré, après quoi `signInWithPassword` échoue avec l'ancienne comme avec la nouvelle adresse, et `child-login` fonctionne avec le même e-mail parent, identifiant et mot de passe (même utilisateur auth) ; un compte neuf n'a pas de connexion directe, changer le mot de passe passe par la base, la suppression coupe `child-login`.

