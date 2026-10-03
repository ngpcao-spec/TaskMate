# À faire par vous (clics dans les tableaux de bord)

Projet Supabase : `olftkozksanvnzlsvwrp` (Sydney) · Web : https://taskmate-rho-nine.vercel.app · Dépôt : `ngpcao-spec/TaskMate`.
Vous n'avez jamais besoin de me donner la clé `service_role` ni le mot de passe de la base — ne les saisissez nulle part dans le dépôt.
**Ordre conseillé** : 1 → 7, puis le contrôle final. Chaque étape dit où cliquer, quoi saisir, comment vérifier.
Les liens directs ci-dessous ouvrent le bon projet si vous êtes connecté à Supabase.

## 0. Avant tout : fusionner les PR dans l'ordre
W1 → W2 → W3 → W4 → cette PR (« prod Supabase + diagnostic »), toutes vers `main`. L'étape 4 applique alors les 10 migrations automatiquement.

## 1. Activer les connexions anonymes (les enfants en ont besoin)
- **Où** : https://supabase.com/dashboard/project/olftkozksanvnzlsvwrp/auth/providers → *Authentication → Sign In / Providers* → section **User Signups**.
- **Faire** : activer **Allow anonymous sign-ins** → **Save**. Vérifier aussi que **Allow new users to sign up** et le fournisseur **Email** sont activés.
- **Vérifier** : app → Réglages → Diagnostic → « Connexions anonymes : OK ».

## 2. Site URL et Redirect URLs
- **Où** : https://supabase.com/dashboard/project/olftkozksanvnzlsvwrp/auth/url-configuration → *Authentication → URL Configuration*.
- **Site URL** : `https://taskmate-rho-nine.vercel.app`
- **Redirect URLs** (bouton *Add URL*, une ligne chacune) : `https://taskmate-rho-nine.vercel.app/**` · `http://localhost:8081/**` (développement local) · *(facultatif, aperçus Vercel)* `https://taskmate-*.vercel.app/**` → **Save changes**.
- **Vérifier** : les 3 lignes apparaissent dans la liste après rechargement de la page.

## 3. Gabarit d'e-mail : afficher le code à 6 chiffres
- **Où** : https://supabase.com/dashboard/project/olftkozksanvnzlsvwrp/auth/templates → *Authentication → Email Templates*.
- **Faire**, pour les **deux** onglets **Magic Link** *et* **Confirm signup** : remplacer le corps du message par
  ```html
  <h2>Code de connexion TaskMate</h2>
  <p>Votre code : <strong>{{ .Token }}</strong></p>
  ```
  puis **Save** (le code seul compte ; le sujet peut rester). `{{ .Token }}` est le code à 6 chiffres.
- **Vérifier** : sur le site, « Je suis parent » → saisir votre e-mail → vous recevez un e-mail avec 6 chiffres (regardez les courriers indésirables). Si l'envoi échoue avec « rate limit », le service d'e-mail intégré est très limité : configurez un SMTP personnalisé (*Authentication → Emails → SMTP Settings*).

## 4. Intégration GitHub : migrations et fonctions automatiques
- **Où** : https://supabase.com/dashboard/project/olftkozksanvnzlsvwrp/settings/integrations → *Project Settings → Integrations → GitHub Integration*.
- **Saisir** : dépôt `ngpcao-spec/TaskMate` · **Working directory** : `.` (point) · branche de production `main` · **Deploy to production** : **ON** · **Automatic branching** : OFF → **Enable integration** (ou **Save** si déjà activée).
- **Ce que ça fait** (doc officielle) : à chaque fusion sur `main`, applique les nouvelles migrations de `supabase/migrations` dans l'ordre (sans le `seed.sql`) et déploie les Edge Functions déclarées dans `supabase/config.toml`. Ne règle **pas** Auth (étapes 1 à 3) ni les secrets (étape 6).
- **Vérifier** (après la fusion de l'étape 0) : *Database → Migrations* liste **10** migrations (de `…core_schema_rls` à `…diagnostics`) ; *Edge Functions* liste `redeem-invite`, `delete-account`, `send-push`.
- **Si une migration échoue** : le message est dans *Project Settings → Integrations → GitHub* (ou le commentaire du commit). Envoyez-le moi.

## 5. Variables d'environnement Vercel
- **Où** : Vercel → projet **taskmate** → *Settings → Environment Variables*. Cocher **Production** et **Preview**.
- **Noms exacts** :

| Nom | Valeur |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://olftkozksanvnzlsvwrp.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | la clé **Publishable** (`sb_publishable_…`), ou à défaut la clé **anon** — Supabase → *Project Settings → API Keys*. **Jamais** `service_role` / « secret ». |
| `EXPO_PUBLIC_WEB_URL` | `https://taskmate-rho-nine.vercel.app` |
| `EXPO_PUBLIC_VAPID_PUBLIC_KEY` | *(facultatif, étape 6)* clé VAPID publique |
| `EXPO_PUBLIC_PRIVACY_URL` | *(facultatif)* URL de la politique de confidentialité |

- **Réglages du projet** (*Settings → General*) : **Root Directory** vide, **Framework Preset** « Other » (le reste vient de `vercel.json`), branche de production `main`.
- **Redéployer** (les variables sont lues au *build*) : *Deployments →* dernier déploiement → ⋯ → **Redeploy**.
- **Vérifier** : app → Réglages → Diagnostic → « Connexion à Supabase : OK » et plus d'alerte « Adresse Supabase de l'application ».

## 6. Edge Functions et secrets
- **Déploiement** : automatique par l'étape 4 (rien à installer). Vérifier dans *Edge Functions* que les 3 fonctions sont listées ; sinon, **méthode de repli sans outil** :
  1. Supabase → https://supabase.com/dashboard/account/tokens → **Generate new token** (nom `github-actions`) → copier le jeton.
  2. GitHub → dépôt → *Settings → Secrets and variables → Actions → New repository secret* : nom `SUPABASE_ACCESS_TOKEN`, valeur = le jeton.
  3. GitHub → onglet *Actions* → **Deploy Edge Functions** → **Run workflow**. Vérifier : le job est vert et les 3 fonctions apparaissent.
- **Secrets** : https://supabase.com/dashboard/project/olftkozksanvnzlsvwrp/functions/secrets → *Edge Functions → Secrets* → **Add new secrets** (clé / valeur) → **Save** :

| Clé | Valeur |
|---|---|
| `WEBHOOK_SECRET` | une chaîne aléatoire d'au moins 32 caractères (« Suggérer un mot de passe fort » sur iPhone). **Notez-la** : étape 7. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | *(Web Push, facultatif)* dans l'app : Réglages → **Diagnostic** → **Générer une paire de clés** (calculé dans votre navigateur, rien n'est stocké). Clé publique → `VAPID_PUBLIC_KEY` **et** Vercel (`EXPO_PUBLIC_VAPID_PUBLIC_KEY`, puis redéployer) ; clé privée → `VAPID_PRIVATE_KEY` **uniquement ici**, jamais ailleurs. `VAPID_SUBJECT` = `mailto:` + votre e-mail. |

  `SUPABASE_URL` et la clé de service sont injectées automatiquement dans les fonctions : ne les saisissez pas.
- **Vérifier** : Diagnostic → les 3 « Edge Function … : OK » (sans `WEBHOOK_SECRET`, `send-push` répond 401 : normal, la fonction existe).

## 7. Database Webhook (notifications)
- **Où** : https://supabase.com/dashboard/project/olftkozksanvnzlsvwrp/integrations/webhooks/overview → *Integrations → Database Webhooks → Create a new hook*.
- **Saisir** : Name `activity-log-push` · Table `public.activity_log` · Events **Insert** · Type **Supabase Edge Functions** · Edge Function `send-push` · Method `POST` · Timeout `5000` · **HTTP Headers** → *Add a new header* : nom `x-webhook-secret`, valeur = **le même** `WEBHOOK_SECRET` → **Create webhook**.
- **Vérifier** : avec un compte enfant, cocher une tâche ; puis *Edge Functions → send-push → Logs* montre un appel en **200** (la réponse contient `"sent":0` tant qu'aucun appareil n'a activé les notifications). Un 401 = secret différent entre l'en-tête et `WEBHOOK_SECRET`.
- *(Facultatif, plus tard)* récap du soir des parents : tâche pg_cron appelant `send-push` avec `{"type":"evening_recap"}` et le même en-tête ; dites-le-moi et je prépare le SQL.

## Contrôle final
App → **Réglages → Diagnostic** → « Relancer » : objectif **0 à corriger**. Les « à surveiller » acceptables : adresse publique vide (corrigée à l'étape 5), clé Web Push (facultative), pg_cron.
Si **pg_cron** est signalé : Supabase → *Database → Extensions* → activer **pg_cron**, puis *SQL Editor* : `select public.schedule_cron_jobs();` → Run. Diagnostic → « Tâches planifiées : OK ».

## À valider sur de vrais appareils (non automatisable)
Installer la PWA (iPhone : Safari → Partager → « Sur l'écran d'accueil » ; Android/Chrome : « Installer l'application »), scanner un QR avec la caméra, recevoir une notification Web Push (iOS ≥ 16.4 et PWA installée uniquement ; l'autorisation se demande depuis le bouton des réglages), latence Realtime (< 5 s).
Limites connues : pas de rappels planifiés « avant l'heure » sur le web (D-035) ; pas de boutons Duyệt/Từ chối dans une notification web (D-034).
