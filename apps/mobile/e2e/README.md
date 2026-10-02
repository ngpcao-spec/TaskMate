# Flows Maestro (E2E)

Prérequis (non exécutables dans l'environnement de développement automatique) :

1. `supabase start` (Docker) puis `supabase db reset` — le `seed.sql` crée la famille de démo.
2. Un build de développement installé sur un simulateur/émulateur : `eas build --profile development --platform ios|android --local`.
3. [Maestro](https://maestro.mobile.dev) : `maestro test e2e/` (ou un flow précis).

Les flows utilisent l'OTP e-mail du serveur local (Inbucket, http://127.0.0.1:54324) : relever le code reçu pour `parent@taskmate.test`,
puis le passer en variable : `maestro test -e OTP=123456 e2e/parent-onboarding.yaml`.

| Flow | Couvre |
|---|---|
| `parent-onboarding.yaml` | splash → parent → OTP → famille → profils enfants → code d'invitation |
| `child-join.yaml` | « Je suis un enfant » → code → confirmation « Bạn là … ? » → accueil |
| `complete-task.yaml` | enfant : cocher → `Chờ duyệt`, aucun point, décocher possible |
| `validate-task.yaml` | parent : bannière « việc chờ duyệt » → file → Duyệt |
| `child-validated.yaml` | enfant : « +10 điểm », solde augmenté |
| `offline-complete.yaml` | cocher hors ligne (mode avion) → `Chờ duyệt` ; retour réseau ; aucun point |
| `reward-request.yaml` | enfant : demande d'échange (points réservés) ; parent : approbation |
| `brother-readonly.yaml` | l'enfant consulte le frère : bandeau lecture seule, pas de FAB |
