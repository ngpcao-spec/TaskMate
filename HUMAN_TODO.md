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
