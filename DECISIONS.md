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
