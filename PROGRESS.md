# Progression
Jalon courant : M9 — à démarrer
Dernière vérification complète : OK (tag m8)

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
