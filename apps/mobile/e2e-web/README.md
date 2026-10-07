# Tests E2E web (Playwright)

Remplacent les flows Maestro (supprimés). Chromium, app exportée en web, Supabase **local**.

| Fichier | Couvre |
|---|---|
| `flows.e2e.ts` | parent crée une tâche → enfant coche (« Chờ duyệt », 0 point) → parent valide → points crédités une seule fois ; enfant hors ligne (coche locale, envoi unique au retour du réseau) ; l'enfant ne voit que ses données (ni frère, ni sélecteur, D-052) + route de création protégée ; révisions (le parent crée et publie ; l'enfant passe l'évaluation, un seul parcours sans retour par question ; le parent valide sans correction — l'enfant ne voit que son score et ses questions ratées —, relance une tentative, valide avec correction ; l'autre enfant ne voit rien) ; renouveler une tâche (duplication sur 2 jours, série hebdomadaire sur 4 semaines, absence côté enfant) ; comptes (connexion Google SIMULÉE — compte dont `app_metadata.provider` = google, session ouverte par mot de passe —, deux parents sur la même famille par code d'invitation, enfant connecté avec l'e-mail du second parent, mêmes erreurs quel que soit le champ faux, verrouillage 429, identifiant unique par famille, un enfant ne peut ni inviter ni gérer un compte, ajout d'un enfant après l'onboarding, aucune connexion directe d'un compte enfant — ancienne adresse devinable migrée, `child-login` seul) ; file « Cần duyệt » en deux colonnes sur grand écran ; navigation clavier + focus visible |
| `pwa.e2e.ts` | manifest installable (icônes, maskable, métadonnées iOS), service worker, démarrage hors ligne |

## En CI
Job `e2e` de `.github/workflows/ci.yml` : `supabase start`, `supabase functions serve` (pour `create-child`, `reset-child-password`, `delete-child`), build web contre le Supabase local, `playwright test`.

## En local
```bash
supabase start && supabase functions serve &           # Docker requis
eval "$(supabase status -o env)"                       # API_URL, ANON_KEY, SERVICE_ROLE_KEY
export E2E_SUPABASE_URL=$API_URL E2E_ANON_KEY=$ANON_KEY E2E_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
EXPO_PUBLIC_SUPABASE_URL=$API_URL EXPO_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY pnpm --filter @taskmate/mobile export:web
pnpm --filter @taskmate/mobile exec playwright install chromium
pnpm --filter @taskmate/mobile e2e:web
```
Chromium préinstallé (sans `playwright install`) : `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium`.
Chaque test crée sa propre famille (comptes `*@e2e.test`) avec la clé de service **locale** — jamais contre un projet cloud.
`pwa.e2e.ts` n'a pas besoin de Supabase.
