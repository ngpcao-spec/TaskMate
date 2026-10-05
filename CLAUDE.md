# TaskMate — mémoire projet

**Langue : réponds toujours en français** (messages, résumés, rapports, descriptions de PR). Le code et les identifiants suivent les conventions du repo ; les messages de commit restent en français.

**Autonomie : ne demande jamais de confirmation à l'humain** pour les actions courantes de développement. Décide, applique, trace dans `DECISIONS.md`. Tu t'arrêtes uniquement pour une action irréversible ou qui exige un compte/secret que tu n'as pas (voir `HUMAN_TODO.md`).

App mobile familiale (Expo + Supabase). Spéc: `SPEC.md` (fait autorité). Travail: `PROGRESS.md`, `DECISIONS.md`, `HUMAN_TODO.md`.

## Commandes
- Install: `pnpm install` (racine)
- Dev: `pnpm --filter @taskmate/mobile start`
- Vérifs: `pnpm -w typecheck`, `pnpm -w lint`, `pnpm -w test`, `pnpm --filter @taskmate/mobile exec expo export --platform ios`
- DB (Docker dispo): `supabase start`, `supabase db reset && supabase test db`, `supabase db lint`
- DB (sans Docker, cf. D-002): `./scripts/db-test.sh` (Postgres 16 local + pgTAP + shim Supabase + `db-concurrency.sh`)
- Types DB : `supabase gen types typescript --local > apps/mobile/src/types/db.ts` (aujourd'hui écrits à la main, D-009)
- Web (cible principale, D-025) : `pnpm --filter @taskmate/mobile export:web` → `apps/mobile/dist` ; implémentations web = fichiers `*.web.ts(x)` à côté des natifs (D-026)
- Production : Supabase (Sydney) via l'intégration GitHub (migrations auto à la fusion sur main, D-043) ; santé du serveur : Réglages → Diagnostic (`diagnostics()` + sondes, D-045)
- E2E web : `apps/mobile/e2e-web/README.md` (Playwright, Supabase local) ; déploiement : `vercel.json` (racine) ; HUMAN_TODO.md liste ce qui demande vos comptes (Supabase cloud, Vercel)

## Architecture
- `apps/mobile/app` : écrans Expo Router uniquement. Écrans → hooks (`src/hooks`) → `src/api` (client Supabase, RPC typés) ; calculs purs dans `src/domain` (couverture ≥ 90 %).
- `src/sync` : persistance TanStack Query, file de mutations hors ligne ; `src/store` : session/rôle ; `src/i18n` : vi (défaut), fr, en.
- `supabase/migrations` : schéma + RLS + RPC + cron ; `supabase/tests` : pgTAP ; `supabase/functions` : Edge Functions.
- Alias `@/` = `apps/mobile/src/`.

## Règles non négociables
- Jamais de secret dans git (seulement `.env.example`). Jamais `--no-verify`, test skip, `@ts-ignore`, RLS relâchée.
- Jamais d'écriture client directe dans `point_transactions` ni `tasks.completed_at` : RPC §5.2 uniquement.
- Toute nouvelle table : RLS dans la même migration + tests pgTAP positifs ET négatifs.
- Aucune chaîne UI en dur (i18n). `accessibilityLabel` + cibles ≥ 44 pt. Aucun écran ne compare/classe les deux enfants.
- `date` d'une tâche = jour local de la famille, jamais dérivé d'un timestamp UTC.
- Ne pas modifier SPEC.md. Pas de `push --force`, pas de réécriture d'historique.
- Git : tu **commites et pousses** sur la branche de travail sans demander, puis vérifies la CI (`gh api repos/{owner}/{repo}/actions/runs`) ; ne déclare jamais la CI verte sans l'avoir constatée. Si une PR est possible (branche de destination distincte), ouvre-la toi-même ; sinon, dis-le en une ligne.
- Interdit sans l'humain : déploiement, publication store, création de projet/ressource cloud, usage de secrets de production.

## État
Jalons M0 → M11 + corrections C1 → C4 livrés (voir PROGRESS.md → rapport final). Spec v4 : l'enfant ne crée/modifie rien ; il coche → `pending`, le parent valide (`validate_task`) → points. Types DB générés (`src/types/db.ts`, contrôlés en CI) ; ne pas les éditer à la main. Captures de comparaison : `tools/visual`. Comptes (D-050) : parent = Google (inscription Google uniquement, e-mail+mot de passe réservé aux comptes existants), plusieurs parents par famille (invitation à code haché 24 h, `parent_invites`) ; enfant = identifiant (unique par famille) + mot de passe créés par un parent via les Edge Functions `create-child` / `reset-child-password` / `delete-child`, connexion par `child-login` SEULE (e-mail d'un parent + identifiant + mot de passe vérifié contre un haché bcrypt, verrouillage IP/famille ; GoTrue n'a qu'une adresse UUID et un mot de passe aléatoire : aucune connexion directe, D-051) ; service_role fournie par l'environnement des fonctions, jamais dans le code ; plus d'OTP, de QR ni de connexion anonyme.
Pièges : jest-expo + RNTL 14 (`await render/fireEvent/act`), tests : utiliser `createTestQueryClient()` (`gcTime: Infinity`) sinon Jest ne se termine pas ; `jest.mock` factories : variables préfixées `mock`,
mutations d'écriture = `sync/mutations.ts` (scope `writes`, ids fixés à la création), nouvelle table = RLS + pgTAP dans la même migration, tests SQL : un fichier = une transaction avec `tests.login(n)`. CLI Supabase épinglée en CI (D-020).
