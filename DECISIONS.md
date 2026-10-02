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
