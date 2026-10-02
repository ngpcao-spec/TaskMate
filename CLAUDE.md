# TaskMate — mémoire projet

App mobile familiale (Expo + Supabase). Spéc: `SPEC.md` (fait autorité). Travail: `PROGRESS.md`, `DECISIONS.md`, `HUMAN_TODO.md`.

## Commandes
- Install: `pnpm install` (racine)
- Dev: `pnpm --filter @taskmate/mobile start`
- Vérifs: `pnpm -w typecheck`, `pnpm -w lint`, `pnpm -w test`, `pnpm --filter @taskmate/mobile exec expo export --platform ios`
- DB (Docker dispo): `supabase start`, `supabase db reset && supabase test db`, `supabase db lint`
- DB (sans Docker, cf. D-002): `./scripts/db-test.sh` (Postgres 16 local + pgTAP + shim Supabase)

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
- Ne pas modifier SPEC.md. Pas de push --force ni d'action sur services distants.
