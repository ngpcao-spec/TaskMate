# Tests E2E web (Playwright)

Remplacent les flows Maestro (supprimés). Chromium, app exportée en web, Supabase **local**.

| Fichier | Couvre |
|---|---|
| `flows.e2e.ts` | parent crée une tâche → enfant coche (« Chờ duyệt », 0 point) → parent valide → points crédités une seule fois ; enfant hors ligne (coche locale, envoi unique au retour du réseau) ; frère en lecture seule + route de création protégée ; comptes sans invitation (inscription e-mail + mot de passe du parent, création du compte enfant dans l'app, connexion enfant identifiant + mot de passe, changement de mot de passe, suppression, identifiant déjà pris, un enfant ne peut appeler aucune Edge Function de comptes) ; file « Cần duyệt » en deux colonnes sur grand écran ; navigation clavier + focus visible |
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
