# Captures web (comparaison maquettes)
1. `pnpm --filter @taskmate/mobile exec expo export --platform web --output-dir dist-web`
2. `cd tools/visual && npm install && node shoot.mjs` (faux serveur Supabase inclus ; Chromium via `PLAYWRIGHT_BROWSERS_PATH`)
Sortie : `docs/screenshots/after/`. Outil de dev uniquement, aucun secret.
