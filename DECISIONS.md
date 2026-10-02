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
