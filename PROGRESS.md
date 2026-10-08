# Progression
Jalon courant : TERMINÉ (M0 → M11) + corrections C1 → C4
Dernière vérification complète (locale, après C3) : typecheck, lint, 299 tests Jest (46 suites, domain ≥ 90 %), 356 assertions pgTAP (9 fichiers) + 5 scénarios de concurrence à 2 sessions (`./scripts/db-test.sh`), `expo export` iOS. Jest se termine seul (sans `--forceExit`).

## RAPPORT FINAL (mis à jour après les corrections C1 → C4)

### État de la CI — constaté
- Avant corrections : **rouge** sur les 11 runs (job `db` : `supabase start` ; job `app` : timeout du test settings au M11). L'ancien rapport « OK » était faux : il ne reflétait que les tests locaux.
- C1 : cause du job `db` = CLI Supabase par défaut (2.20.3) qui rejetait les clés de `config.toml` → CLI épinglée à 2.119.0. Cause du job `app` = timeout (5 s) sur runner froid → `testTimeout: 30000`. Jest ne se terminait pas à cause des minuteurs de garbage-collection de TanStack Query → `gcTime: Infinity` dans le client de test (`test-utils/queryClient.ts`), sans `--forceExit`. Actions passées en versions Node 24 (checkout v6, setup-node v6, pnpm/action-setup v6, supabase/setup-cli v3). Types DB désormais **générés** (`supabase gen types`) et vérifiés par la CI (`git diff --exit-code`).
- **Run vert constaté : [#14, id 36972137433](https://github.com/ngpcao-spec/TaskMate/actions/runs/36972137433)** (commit `9448190`, fin du lot C2) : jobs `app` et `db` verts, y compris `supabase start`, `db reset`, `supabase test db`, `db lint` et le contrôle des types générés.
- **Runs verts constatés** : [#15, id 36973311752](https://github.com/ngpcao-spec/TaskMate/actions/runs/36973311752) (lot C3, `4b31ceb`) et [#16, id 36973414796](https://github.com/ngpcao-spec/TaskMate/actions/runs/36973414796) (lot C4, `35c8137`) — jobs `app` et `db` au vert.

### Jalons et corrections
M0 → M11 (voir ci-dessous) · C1 CI/Jest/types générés · C2 validation parentale des tâches (spec v4) · C3 alignement visuel sur les maquettes · C4 ce rapport.

### Critères d'acceptation
Table « Critères d'acceptation → tests » en fin de fichier : tous couverts par un test automatisé sauf un partiel (latence Realtime < 5 s, à mesurer sur appareil). Les flows Maestro sont écrits (`apps/mobile/e2e`, dont `validate-task.yaml` et `child-validated.yaml`) mais **non exécutés**.

### Ce qui reste NON vérifié
- Aucun test sur **appareil réel** (iOS/Android) : NetInfo/MMKV natifs, caméra QR, rendu natif, polices, safe areas.
- **Push réelles** (APNs/FCM, webhook, Edge Function déployée, actions Duyệt / Từ chối depuis la notification) : seule la logique pure et le mapping d'actions sont testés en Jest.
- **Latence Realtime < 5 s** : la chaîne est testée, pas la durée réelle.
- **Maestro** : flows jamais exécutés (nécessite un build de développement + simulateur).
- **Comparaison aux maquettes** : faite sur un rendu web (react-native-web + faux serveur), pas sur appareil ; voir la table C3.
- Apple/Google Sign-In, projet Supabase cloud, EAS, stores : non réalisés (HUMAN_TODO).

### À faire par vous, dans l'ordre (`HUMAN_TODO.md`)
#1 projet Supabase cloud → #2 fonctions + auth anonyme → #3 push (EAS projectId, APNs/FCM, webhook, cron récap) → #4 Apple/Google → #5 assets → #6 confidentialité & stores → #7 Maestro → #8 validation sur appareils.

### Dette technique connue
- Apple/Google : boutons derrière un flag, handlers à brancher (D-013).
- Jetons push invalides nettoyés au ticket Expo uniquement ; textes push en vietnamien uniquement.
- Création/édition de **séries** récurrentes en ligne uniquement ; changement d'enfant d'une série non supporté.
- Avatars = initiales ; icône/splash = placeholders ; illustration du splash = SVG simplifié.

## M0 — Squelette
- [x] Monorepo pnpm, Expo SDK 57 + Router, TS strict
- [x] Theme (tokens §6.2, catégories §4.3), i18n vi/fr/en
- [x] Jest + ESLint, domain/age + test
- [x] CI GitHub, `.env.example`, config Supabase
- [x] CLAUDE.md, scripts DB locaux, commit + tag m0 ✅

## M1 — Schéma & sécurité ✅ (tag m1)
Migrations `20260702000001` (tables + RLS + gardes) et `...02` (RPC points/récompenses/invitations/appareils, vue `child_balances`, expiration + pg_cron).
223 assertions pgTAP (`supabase/tests/database/01..04`) + `scripts/db-concurrency.sh` (2 sessions réelles). Différé : types générés, `supabase db lint` (D-009).

## M2 — Onboarding & auth ✅ (tag m2)
Client Supabase (session chunkée SecureStore), types DB, `redeem_invite` + limite de tentatives (migration 3, D-011), Edge Function `redeem-invite`,
écrans role/parent-auth/family/children (codes + QR)/join (saisie, QR, lien profond), routage par rôle (`domain/entry-route`).
Différé : Apple/Google réels (D-013), non testé sur simulateur (pas de device ici) — couvert par tests Jest + `expo export`.

## M3 — Accueil + tâches ✅ (tag m3)
Accueil (pills, bandeau lecture seule, anneau, liste triée, swipe-suppression, FAB), formulaire Thêm việc (3 types d'horaire, catégories, note, points/« pour qui » parent),
coche/décoche optimistes via RPC (tx_id fixé à la création), droits enfant/parent (`domain/permissions`), toasts. Domain : task-time, progress, permissions, task-form, family-time (100 % lignes).
Différé : bannière « demandes à approuver » (M6), cloche notifications (M9), répétition dans « Plus d'options » (M10), création/édition hors ligne (M4).

## M4 — Hors ligne & temps réel ✅ (tag m4)
Cache TanStack persisté (MMKV), file d'écritures FIFO persistée et reprise (retries idempotents, ordre garanti), création/édition/suppression/coche optimistes hors ligne,
bandeau hors-ligne/synchro + indicateur par ligne, Realtime par famille (migration 4 + pgTAP 05), purge du cache au changement de compte, appareil révoqué → re-jointure.
Différé : validation sur appareil réel (NetInfo/MMKV natifs) — couvert par Jest (file, persistance, realtime avec canal simulé).

## M5 — Calendrier ✅ (tag m5)
Bandeau semaine T2→CN, swipe/boutons semaine, sélecteur de date, titre du jour via date-fns (`domain/calendar`), cartes teintées 12 % (faites atténuées), vue semaine groupée, pills de profil (frère en lecture seule).
Test clé : jeudi 2/7/2026 → « Thứ Năm » sous T5.

## M6 — Points & récompenses ✅ (tag m6)
Écran Điểm (solde projeté, réservé, historique), liste récompenses grisées selon le DISPONIBLE, flux enfant (confirmation → demande), file « Cần duyệt » parent (approuver/refuser + motif), annulation, section Demandes (30 j),
CRUD récompenses, ajustement manuel (motif obligatoire), bannière « demandes à approuver » sur l'accueil parent, profil (cartes + menu) et « Danh sách việc » (filtres + recherche).
Échanges nécessitent le réseau (boutons désactivés + message). Côté serveur : RPC/RLS/expiration déjà couverts par pgTAP (M1).
Différé : actions Approuver/Refuser dans la notification push (M9).

## M7 — Objectifs ✅ (tag m7)
Écran Mục tiêu (cartes, barre, « 3/5 », −/+ manuel optimiste, badge + toast à l'atteinte), formulaire (titre, icône, cible ≥ 1, unité), frère en lecture seule.
Serveur : `achieved_at` + `activity_log goal_achieved` posés par trigger (pgTAP 06) ; notification push au parent en M9. Progression manuelle (hypothèse §9 Q3).

## M8 — Statistiques ✅ (tag m8)
`domain/stats.ts` (période semaine/mois dans le fuseau famille, total/faites/non faites, taux arrondi, répartition, encouragement), écran Thống kê (anneau, légende, barres par catégorie, carte d'encouragement), frère en lecture seule, calcul 100 % local (hors ligne).

## M9 — Notifications ✅ (tag m9)
Rappels locaux (`domain/reminders` → `services/notifications.syncLocalReminders`, identifiants stables, replanifiés à chaque synchro, ≤ 60), préférences (`notification_prefs` + RLS + écran), actions Approuver/Refuser dans la notification,
Edge Function `send-push` (destinataires/préférences/jetons invalides, logique pure testée), journal `task_assigned` (trigger), centre de notifications + cloche, enregistrement du jeton push.
Non vérifiable ici : push réels (EAS/APNs/FCM) → HUMAN_TODO #6 ; livraison réelle des notifications locales sur appareil.

## M10 — Récurrence ✅ (tag m10)
Migration 6 : `generate_recurrence/generate_all_recurrences` (14 jours glissants, fuseau famille), trigger de synchronisation (futur non fait), cron horaire (D-018). pgTAP 08 (30 assertions : quotidien, jours choisis, bornes, modification, suppression, fuseaux, droits) + test de concurrence à 2 sessions.
Client : option « Lặp lại » (parent), « appliquer à la série », « supprimer la série ».

## M11 — Finition ✅ (tag m11)
Réglages généraux (langue vi/fr/en persistée, déconnexion), parent : gestion des enfants + codes/QR, appareils liés (révocation), invitation co-parent, fuseau famille, **suppression du compte et des données** (RPC `delete_family` + Edge Function `delete-account`, pgTAP 09),
accessibilité (libellés + cibles ≥ 44 pt testés), états vides, flows Maestro, `eas.json`, politique de confidentialité, config Supabase (auth anonyme, fonctions).

## Critères d'acceptation → tests
| Critère §8 | Test | Statut |
|---|---|---|
| Cocher hors ligne puis revenir en ligne crédite une seule fois | `02_rpc_points` (serveur) + `offline-queue.test` (même tx_id sur chaque retry/reprise/redémarrage) | ✅ |
| Minh coche → visible chez le parent en < 5 s | `realtime.test` (événement → invalidation de la liste de l'enfant) + pgTAP 05 (publication) ; délai réel à mesurer sur appareil | ⚠️ partiel |
| Enfant lit son frère, n'écrit rien, pas de points | `01_rls` (tasks/goals/rewards/point_transactions/children) + `02` forbidden | ✅ |
| Demande d'échange réserve sans débiter ; seule l'approbation débite | `03_rpc_rewards` (request / approve) | ✅ |
| 2 demandes simultanées > solde : la seconde refusée | `03` (séquentiel) + `db-concurrency.sh` (2 sessions) | ✅ |
| 2 parents approuvent en même temps : un seul débit | `03` + `db-concurrency.sh` | ✅ |
| Refus/annulation/expiration : disponible revient | `03_rpc_rewards` (cancel/reject/expiration) | ✅ |
| Appareil révoqué perd l'accès | `02` (membre révoqué), `04` (revoke_device) | ✅ |
| Chaque politique RLS : test positif et négatif | `01_rls` | ✅ |
| Tâche supprimée par le parent pendant que l'enfant coche : échec propre + toast | `useToggleTask.test` (task_not_found) + `02_rpc_points` | ✅ |
| Aucun écran n'affiche les deux enfants côte à côte ni de classement | `stats.test` (une seule légende), tests écrans today/goals/points : un seul profil affiché à la fois ; pastilles = âge uniquement | ✅ |
| Le jour affiché dans le calendrier correspond au jour réel (« Thứ Tư » sous T5 dans les maquettes) | `domain/calendar.test` + `calendar.test.tsx` | ✅ |
| Stats d'une période vide : « — » et pas « NaN % » | `domain/stats.test`, `stats.test.tsx` | ✅ |
| Couverture ≥ 90 % sur `src/domain/` | `jest --coverage` (seuil 90 % imposé dans jest.config) | ✅ |
| Une tâche créée par le parent pour 20:00 déclenche un rappel local sur le téléphone de l'enfant | `notifications-service.test` (19:50 heure famille, replanif. sans doublon) + `domain/reminders.test` + pgTAP 07 (`task_assigned`) | ✅ |
| Aucune notification à un enfant sur l'activité de son frère | `send-push-logic.test` (recipientsFor) | ✅ |
| Récurrence : pas de doublon même si deux générations se chevauchent | pgTAP 08 (idempotence, `unique(recurrence_id,date)`) + `db-concurrency.sh` (2 sessions) | ✅ |
| Accessibilité : libellés sur tous les éléments interactifs, cibles ≥ 44 pt (§Qualité) | `a11y.test` | ✅ |
| Suppression du compte et des données (stores) | pgTAP 09 + `settings.test` | ✅ |

## C3 — Alignement visuel sur les maquettes

**Méthode de comparaison.** `docs/mockups/taskmate.png` (8 écrans) a été ouvert avec l'outil de lecture d'images. L'app est exportée en web (`react-native-web`, `expo export --platform web`), servie avec un faux serveur PostgREST/Auth Node (`tools/visual/mock-server.mjs`, données `fixtures.mjs`) et photographiée avec Playwright + le Chromium préinstallé (`tools/visual/shoot.mjs`, viewport 390×844 @2x). Captures « avant » : `docs/screenshots/before/`, « après » : `docs/screenshots/after/`. Ce rendu web n'est pas un rendu iOS/Android natif (polices, ombres, safe areas diffèrent) : la comparaison valide la composition, les couleurs, les rayons et les libellés, pas le rendu pixel-perfect sur appareil.

| Écran | Écarts corrigés | Écarts restants |
|---|---|---|
| Splash / rôle | Fond dégradé ciel + silhouettes familiales (SVG), logo et accroche, bouton principal arrondi | Illustration simplifiée (SVG maison, pas l'illustration exacte de la maquette) |
| Accueil | Salutation + sous-titre, pastilles enfants teintées, anneau de progression + « n/m việc đã hoàn thành », lignes de tâche en cartes avec icône catégorie, tokens (rayons 16–24, couleurs, ombres), barre d'onglets 4 entrées | Polices système au lieu de la police des maquettes ; états `Chờ duyệt` / refusée absents des maquettes (style cohérent ajouté) |
| Calendrier | Bandeau semaine, carte mois, sélection de jour, lignes de tâches | Pastilles enfants retirées (§1/§3 : pas de comparaison entre enfants) |
| Ajout de tâche | Champs arrondis, placeholders, sélecteur catégorie/jour, note, bouton enregistrer | Sélecteurs de date/heure natifs non reproduits en web |
| Profil (Plus) | Cartes enfants sélectionnables avec coche, liste de menu dans une carte, icônes colorées | Badge « à valider » et entrées parent propres à la spec v4 |
| Objectifs | Cartes avec pastille d'icône, barre fine, n/m, pas −/+, bouton « + Thêm mục tiêu » | — |
| Points | Médaille étoile, solde, liste de récompenses dans une carte avec pastilles colorées, bandeau | Ligne « +X điểm chờ duyệt » et bouton d'ajustement parent (spec v4) |
| Statistiques | Segment Tuần/Tháng, anneau + légende à 3 lignes, barres par catégorie, message d'encouragement avec trophée | Pas de comparatif entre enfants (spec prime) |
| File « Cần duyệt » (hors maquettes) | Style aligné sur les cartes ci-dessus | Aucune maquette de référence |
| Réglages (hors maquettes) | Cartes/rangées au même style | Aucune maquette de référence |

Vérifications locales : typecheck, lint, 299 tests Jest, `expo export --platform ios` OK. CI du lot : voir rapport final (C4).
| **v4** Un enfant ne peut ni créer, ni modifier, ni supprimer une tâche (scénario « 30 tâches bidon ») | `01_rls` (INSERT/UPDATE/DELETE refusés), `07` (insert préférences refusé), `task-routes.test` (routes protégées) | ✅ |
| **v4** Coche enfant ⇒ `pending`, solde inchangé, aucun crédit optimiste | `02_rpc_points`, `domain/task-state.test`, `today.test`, `useToggleTask.test` | ✅ |
| **v4** Décoche enfant : OK si `pending`, refusée si validée (`already_validated`) | `02_rpc_points`, `permissions.test` | ✅ |
| **v4** Validation parent ⇒ points une seule fois (rejeu `tx_id`) | `02_rpc_points` + `db-concurrency.sh` (2 parents valident en même temps : un seul crédit) | ✅ |
| **v4** Refus ⇒ `todo` + motif, aucun point ; validation après décoche ⇒ `not_pending` ; validation vs refus simultanés : un seul résultat | `02_rpc_points`, `db-concurrency.sh`, `approvals.test` | ✅ |
| **v4** Coche parent ⇒ validée d'office ; décoche parent d'une validée ⇒ débit exact, refusé si disponible < 0 | `02_rpc_points` | ✅ |
| **v4** Coche enfant hors ligne = `pending` seulement ; validation parent hors ligne créditée une seule fois | `validation-queue.test`, `projected-balance.test`, `offline-queue.test` | ✅ |
| **v4** File « Cần duyệt », « Duyệt tất cả » par enfant, badge, ligne « +X điểm chờ duyệt » | `approvals.test`, `domain/approvals.test`, `points.test` | ✅ |
| **v4** Push : `task_completed` regroupée < 10 min, actions Duyệt/Từ chối, `task_validated`/`task_rejected` à l'enfant, récap avec nombre en attente | `send-push-logic.test`, `notification-actions.test`, `notifications-service.test` (appareil réel non testé) | ⚠️ logique seule |
| CI verte | Runs #14, #15 et #16 verts, voir « État de la CI » | ✅ constaté |

## Changement produit — comptes e-mail/identifiant (D-048)
Invitations/QR/OTP/connexion anonyme remplacés par : parent e-mail + mot de passe ; enfant identifiant + mot de passe créé par le parent (Edge Functions `create-child`, `reset-child-password`, `delete-child`). Migration `…0011_child_accounts`, pgTAP 12, tests Jest (domaine, fonctions, écrans) et E2E adaptés. Les sections ci-dessus décrivent l'ancien flux d'invitation (historique).

## Révisions : supports multiples (D-061, D-062) — fusionnées le 2026-10-08
Livrées en deux PR : [#13](https://github.com/ngpcao-spec/TaskMate/pull/13) (parent et serveur, migration `…000017`, fusion `a8f6c89`) et [#14](https://github.com/ngpcao-spec/TaskMate/pull/14) (côté enfant, migration `…000018`, fusion `461ca4f`). Détail et choix dans DECISIONS.md (D-061, D-062) ; tests : pgTAP `21_material_kinds` et `22_paper_support`, Jest (`answer-grid`, `import-document`, `paper-sheet`, `generate-questions-function`), E2E web (examen détecté → grille Đáp án → publication refusée par le serveur ; feuille de réponses de l'enfant).

État constaté (API GitHub / Supabase, lecture seule) :
- CI de chaque PR avant fusion : `app`, `db`, `e2e` verts sur le dernier commit (#13 : `ff21cf1` ; #14 : `db3b9b1`, run `push` et run `pull_request`).
- CI de `main` : `a8f6c89` verte ; `461ca4f` **`app` et `db` verts, `e2e` rouge** — un test (feuille de réponses) lisait la base avant l'arrivée de l'envoi au serveur, défaut du test et non de l'application ; correctif en PR [#15](https://github.com/ngpcao-spec/TaskMate/pull/15) (non fusionnée tant que sa CI n'est pas constatée verte).
- Production Supabase : migrations `000017` et `000018` appliquées ; fonctions redéployées (`generate-questions` v3 à 02:00:31 UTC).
- Déploiement Vercel de `main` : non constatable avec les outils de la session.
- Reste à faire par l'humain : vérifier sur téléphone (voir le rapport de la PR #14) ; la clé `OPENAI_API_KEY` est déjà en place (D-060).
