# À faire par vous (clics dans les tableaux de bord)

Projet Supabase : `olftkozksanvnzlsvwrp` (Sydney) · Web : https://taskmate-rho-nine.vercel.app · Dépôt : `ngpcao-spec/TaskMate`.
Vous n'avez jamais besoin de me donner la clé `service_role` ni le mot de passe de la base — ne les saisissez nulle part dans le dépôt.
**Ordre obligatoire** : 1 → 2 → 3 → 4 → 5, **puis seulement** la fusion des PR, puis 6 → 7, puis le contrôle final.
Pourquoi : l'intégration GitHub de l'étape 4 doit être active **avant la première fusion sur `main`**, sinon les migrations ne se déclenchent pas ; et les variables Vercel de l'étape 5 doivent exister avant le premier déploiement de `main`.
Chaque étape dit où cliquer, quoi saisir, comment vérifier. Les liens directs ouvrent le bon projet si vous êtes connecté à Supabase.

## 1. Connexion Google (parents) et réglages d'authentification
- **Où** : https://supabase.com/dashboard/project/olftkozksanvnzlsvwrp/auth/providers → *Authentication → Sign In / Providers*.
- **Google** : fournisseur **Google** activé avec l'ID client et le secret Google — **déjà fait**. Vérifier une fois que, dans la console Google Cloud (*APIs & Services → Identifiants → votre client OAuth*), l'URI de redirection autorisée est `https://olftkozksanvnzlsvwrp.supabase.co/auth/v1/callback`.
- **Garder activés** : **Allow new users to sign up** (nécessaire à l'inscription Google) et le fournisseur **Email** (les parents historiques s'y connectent encore). Ne touchez pas à *Minimum password length* (6 : les enfants ont 6 caractères minimum). **Confirm email** n'a plus d'importance (l'application n'envoie aucun e-mail).
- **L'inscription par e-mail est bloquée côté serveur** : un compte e-mail ordinaire ne peut ni créer ni rejoindre une famille (`google_required`, D-050). Rien à régler dans le tableau de bord.
- **Connexions anonymes — à COUPER après le déploiement de cette PR** : *Authentication → Sign In / Providers → User Signups* → **Allow anonymous sign-ins** → désactiver → **Save**. Plus aucun compte anonyme n'existe (les enfants ont un compte identifiant + mot de passe) : rien ne casse.
- **Vérifier** : app → Réglages → Diagnostic → « Connexion Google : OK » et « Connexion e-mail (parents existants) : OK ».

## 2. Site URL et Redirect URLs
- **Où** : https://supabase.com/dashboard/project/olftkozksanvnzlsvwrp/auth/url-configuration → *Authentication → URL Configuration*.
- **Site URL** : `https://taskmate-rho-nine.vercel.app`
- **Redirect URLs** (bouton *Add URL*, une ligne chacune) : `https://taskmate-rho-nine.vercel.app/**` · `http://localhost:8081/**` (développement local) · *(facultatif, aperçus Vercel)* `https://taskmate-*.vercel.app/**` → **Save changes**.
- **Vérifier** : les 3 lignes apparaissent dans la liste après rechargement de la page.

## 3. Rien à configurer pour les e-mails
Plus de gabarit d'e-mail, plus de code à 6 chiffres, plus de SMTP : l'application n'envoie aucun e-mail. (Étape conservée pour garder la numérotation.)

## 4. Intégration GitHub : migrations et fonctions automatiques
- **Où** : https://supabase.com/dashboard/project/olftkozksanvnzlsvwrp/settings/integrations → *Project Settings → Integrations → GitHub Integration*.
- **Saisir** : dépôt `ngpcao-spec/TaskMate` · **Working directory** : `.` (point) · branche de production `main` · **Deploy to production** : **ON** · **Automatic branching** : OFF → **Enable integration** (ou **Save** si déjà activée).
- **Ce que ça fait** (doc officielle) : à chaque fusion sur `main`, applique les nouvelles migrations de `supabase/migrations` dans l'ordre (sans le `seed.sql`) et déploie les Edge Functions déclarées dans `supabase/config.toml`. Ne règle **pas** Auth (étapes 1 à 3) ni les secrets (étape 6).
- **Vérifier maintenant** : la page *Integrations → GitHub* affiche le dépôt `ngpcao-spec/TaskMate` connecté, **Deploy to production** sur ON, branche `main`. Rien ne s'applique tant que vous n'avez pas fusionné (section suivante) ; le résultat se vérifie après la fusion : *Database → Migrations* liste **12** migrations (de `…core_schema_rls` à `…google_parents_family_child_login`) et *Edge Functions* liste `child-login`, `create-child`, `reset-child-password`, `delete-child`, `delete-account`, `send-push`.
- **Si une migration échoue** : le message est dans la coche/croix à côté du commit de fusion sur GitHub (clic → *Details*). Envoyez-le moi.

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
- **Quand redéployer** : les variables sont lues au *build*. Saisies **avant** la première fusion, elles servent dès le premier déploiement de `main` (rien à faire). Si vous les changez plus tard : *Deployments →* dernier déploiement → ⋯ → **Redeploy**.
- **Vérifier** : le tableau affiche 3 variables obligatoires cochées Production + Preview. Le contrôle fonctionnel se fait après les fusions (Réglages → Diagnostic : « Connexion à Supabase : OK », plus d'alerte « Adresse Supabase de l'application »).

## ▶ FUSION DES PR (seulement après les étapes 1 à 5)
Les 5 PR sont **empilées** : #1 cible `main`, #2 cible la branche de #1, #3 celle de #2, etc. Si une branche n'est pas supprimée après sa fusion, la PR suivante fusionne dans l'ancienne branche et **`main` reste incomplet**. Suivez exactement ceci, **dans l'ordre #1 → #2 → #3 → #4 → #5** (https://github.com/ngpcao-spec/TaskMate/pulls) :
1. Ouvrir la PR. Sous le titre, lire « *X wants to merge … into* **`main`** » : la branche de destination doit être `main`. Pour #1 c'est déjà le cas. Pour #2 à #5, ce sera `main` **uniquement si** vous avez supprimé la branche de la PR précédente (point 4).
   - Si la destination n'est **pas** `main` : ne fusionnez pas. Cliquer **Edit** (à droite du titre) → liste « base » → choisir `main` → **Change base**.
2. Vérifier que les contrôles en bas de page sont verts (« All checks have passed »). Le contrôle Vercel peut rester en attente : sans importance.
3. Cliquer la flèche à droite de **Merge pull request** → choisir **Create a merge commit** (**pas** « Squash and merge », **pas** « Rebase and merge ») → **Confirm merge**.
4. Cliquer **Delete branch** (bouton affiché juste après la fusion). C'est ce clic qui fait cibler `main` à la PR suivante.
5. Passer à la PR suivante et recommencer au point 1.
**Contrôle après la dernière** (#5) : sur https://github.com/ngpcao-spec/TaskMate (branche `main`), vérifier que le dossier `apps/mobile/e2e-web` et le fichier `supabase/migrations/20260702000010_diagnostics.sql` existent. Puis étape *Vérifier* de l'étape 4 : *Database → Migrations* = 10 lignes, *Edge Functions* = 3 fonctions.
*Raccourci équivalent* : la branche de #5 contient déjà tous les commits des 4 PR précédentes. Fusionner **seulement #5** (même procédure : « Create a merge commit ») met aussi `main` complet en un clic ; les PR #1 à #4 se ferment alors d'elles-mêmes comme « Merged ».
*Si vous avez fusionné par erreur dans une ancienne branche* : ouvrir une nouvelle PR depuis `claude/prod-supabase` vers `main` (Pull requests → New pull request → base `main`, compare `claude/prod-supabase`) et la fusionner : cela rattrape tout.

## ▶ PLAN B — Database → Migrations est vide après les fusions
Sans aucune clé secrète. Essayer dans l'ordre :
1. **Comprendre** : GitHub → `main` → page du dernier commit (clic sur le message) → l'icône à côté du titre (coche/croix/rond) → **Details** → ligne « Supabase » : le message dit pourquoi (intégration non activée, mauvais *Working directory*, erreur SQL…). Corriger l'étape 4 si besoin (**Working directory** = `.`, **Deploy to production** = ON, branche = `main`).
2. **Re-déclencher sans outil** (un commit « vide » n'existe pas dans l'interface web ; un commit qui touche `supabase/` fait la même chose) : GitHub → dépôt → dossier `supabase` → **Add file → Create new file** → nom `redeploy.txt` (dans `supabase/`), contenu `redeploy` → **Commit changes… → Commit directly to the `main` branch** → **Commit changes**. Attendre 1 à 2 minutes puis recharger *Database → Migrations*. (Vous pouvez supprimer ce fichier ensuite : même procédure, corbeille.)
3. **Appliquer à la main** (dernier recours, toujours sans clé) : Supabase → *SQL Editor* → *New query*. Pour **chaque** fichier de `supabase/migrations`, **dans l'ordre des noms** (…0001 puis …0002 … jusqu'à …0012) : ouvrir le fichier sur GitHub → **Copy raw file** → coller dans l'éditeur → **Run** → attendre « Success ». S'arrêter à la première erreur et me l'envoyer. Ensuite, **une seule fois**, enregistrer les migrations comme appliquées (sinon l'intégration tentera de les rejouer) : nouvelle requête →
   ```sql
   create schema if not exists supabase_migrations;
   create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
   insert into supabase_migrations.schema_migrations (version, name) values
     ('20260702000001','core_schema_rls'), ('20260702000002','rpc_points_invites'), ('20260702000003','redeem_rate_limit'),
     ('20260702000004','realtime'), ('20260702000005','notification_prefs'), ('20260702000006','recurrence'),
     ('20260702000007','delete_family'), ('20260702000008','task_validation'), ('20260702000009','web_push'),
     ('20260702000010','diagnostics'), ('20260702000011','child_accounts'), ('20260702000012','google_parents_family_child_login')
   on conflict (version) do nothing;
   ```
   → **Run**. Les Edge Functions se déploient alors par la méthode de repli de l'étape 6.

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
Installer la PWA (iPhone : Safari → Partager → « Sur l'écran d'accueil » ; Android/Chrome : « Installer l'application »), connecter un enfant sur son propre téléphone (identifiant + mot de passe créés par le parent), recevoir une notification Web Push (iOS ≥ 16.4 et PWA installée uniquement ; l'autorisation se demande depuis le bouton des réglages), latence Realtime (< 5 s).
Limites connues : pas de rappels planifiés « avant l'heure » sur le web (D-035) ; pas de boutons Duyệt/Từ chối dans une notification web (D-034).
