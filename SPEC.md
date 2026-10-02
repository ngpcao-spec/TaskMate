# TaskMate — Spécification fonctionnelle & choix techniques

> Document de référence pour Claude Code. À placer à la racine du repo (`SPEC.md`) et à référencer depuis `CLAUDE.md`.
> Source : 8 maquettes mobiles (UI en vietnamien). Les hypothèses prises là où les maquettes sont muettes sont marquées **[H]** et listées en fin de document.
> **v3** : chaque enfant sur son propre téléphone (synchro multi-appareils) ; coche libre ; échanges soumis à approbation parentale ; frères visibles en lecture seule, sans classement.

---

## 1. Vision produit

TaskMate est une app mobile familiale de gestion de tâches quotidiennes pour deux enfants (un ado de 17 ans, un de 13 ans). Chaque enfant a son propre téléphone, son planning, ses objectifs et un solde de points gagnés en accomplissant ses tâches, échangeables contre des récompenses (temps de jeu, film, téléphone, snack).

Slogan affiché : *« Việc nhỏ hôm nay — Tương lai lớn ngày mai »* (Petites tâches aujourd'hui, grand avenir demain).

### Personas et appareils
- **Enfant (Minh 17 ans, Khang 13 ans)** — sur **son propre téléphone**, l'app est liée à son profil : il consulte et coche librement ses tâches, en ajoute, suit ses objectifs, demande à échanger ses points. Il peut **consulter le profil de son frère en lecture seule** (planning, objectifs, points, stats), sans classement ni comparaison.
- **Parent [H]** — sur son téléphone, la même app en **mode parent** : il voit les deux enfants, crée et édite tâches, objectifs et récompenses, **approuve ou refuse les demandes d'échange**, ajuste les points, reçoit les notifications d'activité.

### Décisions produit validées
- **Tâches** : l'enfant coche librement, les points sont crédités immédiatement, sans validation parentale.
- **Récompenses** : un échange est une **demande** soumise à l'approbation d'un parent.
- **Frères** : chacun voit les données de l'autre en lecture seule ; **aucun classement**, aucune comparaison chiffrée entre eux.

### Périmètre V1
- Une **famille** = 1 à 2 parents + N enfants (2 aujourd'hui, le modèle n'impose pas de limite).
- Données synchronisées en temps réel entre les téléphones via un backend.
- **Fonctionne hors ligne** : l'enfant peut consulter et cocher ses tâches sans réseau ; synchronisation au retour du réseau.
- Une seule app publiée (iOS + Android), le rôle est déterminé par le compte.

---

## 2. Navigation

### 2.1 Premier lancement (onboarding)
```
Splash (logo + slogan + « Bắt đầu »)
├── « Je suis parent »  → connexion (email OTP / Apple / Google)
│                        → créer la famille OU rejoindre une famille existante (code co-parent)
│                        → créer les profils enfants (prénom, date de naissance, avatar, couleur)
│                        → afficher un code d'invitation / QR par enfant
└── « Je suis un enfant » → scanner le QR ou saisir le code à 6 caractères
                         → confirmation « Bạn là Minh? » → app verrouillée sur ce profil
```

L'écran de démarrage des maquettes (deux cartes profil + « Bắt đầu ») devient, côté parent, l'écran de sélection de l'enfant à afficher.

### 2.2 Structure des onglets

```
Tabs
├── Hôm nay   (Accueil)      ── FAB (+) → Thêm việc (modal)
├── Lịch      (Calendrier)   ── Xem lịch tuần
├── Thống kê  (Statistiques)
└── Thêm      (Plus) = Hồ sơ (Profil)
              ├── Danh sách việc       (toutes les tâches)
              ├── Mục tiêu             (Objectifs)
              ├── Điểm thưởng          (Points & récompenses)
              ├── Cài đặt thông báo    (Notifications)
              └── Cài đặt chung        (Réglages généraux)
```

| Élément | Mode enfant | Mode parent |
|---|---|---|
| Pills / cartes de profil | visibles ; son profil par défaut, celui du frère en **lecture seule** | visibles, sélection de l'enfant affiché |
| Récompenses | lecture + demande d'échange | CRUD + approbation des demandes |
| Demandes en attente | les siennes (annulables) | file « À approuver » avec badge |
| Gestion des enfants & codes d'invitation | — | Réglages généraux |
| Ajustement manuel des points | — | oui |
| Historique d'activité de la famille | — | oui |

---

## 3. Écrans — spécification fonctionnelle

### 3.1 Splash / choix du profil
- Logo, nom « TaskMate », slogan, illustration plein écran, bouton « Bắt đầu ».
- **Mode parent** : deux cartes enfant (avatar, « Con trai lớn / Con trai út », âge). Tap = enfant affiché.
- **Mode enfant** : affiché uniquement au premier lancement, puis l'app ouvre directement l'accueil.

### 3.2 Accueil (Hôm nay)
- En-tête : avatar, « Chào {prénom}! », sous-titre d'encouragement, icône cloche (→ centre de notifications **[H]**).
- Pills de profil (« 17 tuổi » / « 13 tuổi ») dans les deux modes. En mode enfant, la pill du frère ouvre son profil en **lecture seule** : cases à cocher désactivées, pas de FAB, pas d'édition ni de swipe, bandeau discret « Đang xem lịch của {prénom} ».
- Mode parent : bannière « X demandes à approuver » en haut de l'accueil s'il y en a.
- Carte progression : anneau + « Hôm nay X/Y việc đã hoàn thành ». Tap → Statistiques.
- Liste « Việc cần làm hôm nay » triée par heure de début (ou d'échéance), tâches sans heure en dernier.
  - Chaque ligne : case à cocher, titre, plage horaire ou échéance, icône de catégorie.
  - Cocher = tâche faite → points crédités (§5.2). Décocher = annulation des points.
  - Tâche en attente de synchronisation : petit indicateur discret **[H]**.
  - Tap sur la ligne → édition. Swipe → supprimer (selon droits §5.7).
- FAB « + » → écran Thêm việc.

### 3.3 Calendrier (Lịch)
- Bandeau semaine de lundi (T2) à dimanche (CN), jour sélectionné surligné, aujourd'hui marqué.
- Swipe horizontal = semaine précédente/suivante. Icône calendrier → sélecteur de date.
- Titre du jour (« Thứ Tư, 2 tháng 7 ») **calculé via date-fns locale `vi`**, jamais en dur.
- Cartes de tâches colorées par catégorie : horaire + titre. Tâches faites atténuées **[H]**.
- « Xem lịch tuần » → vue semaine compacte (liste groupée par jour) **[H]**.

### 3.4 Ajouter / éditer une tâche (Thêm việc)
| Champ | Règle |
|---|---|
| Tên công việc (titre) | requis, 1–80 caractères |
| Danh mục (catégorie) | requis, une parmi les 5 catégories (§4.3) ; défaut Học tập |
| Thời gian (moment) | requis ; défaut « aujourd'hui, prochaine demi-heure » |
| Ghi chú (note) | optionnel, ≤ 500 caractères |

Le champ Thời gian ouvre une feuille avec la date et un type horaire :
- `range` : début–fin (ex. 08:00–08:45)
- `deadline` : « avant HH:MM » (ex. « Trước 21:00 »)
- `anytime` : dans la journée, sans heure

Les maquettes montrent les deux premiers formats dans les listes mais un seul champ horaire dans le formulaire : on gère les trois.

Options repliées sous « Plus d'options » **[H]** :
- Répétition : aucune / quotidienne / jours de semaine choisis.
- Points attribués (défaut 10) : **modifiable uniquement par un parent**.
- En mode parent : sélecteur « Pour qui ? » (un enfant, ou les deux → crée une tâche par enfant).

Bouton « Lưu » désactivé tant que le formulaire est invalide. Après sauvegarde : retour + toast. La création fonctionne hors ligne.

### 3.5 Profil (Hồ sơ)
- **Mode parent** : cartes des enfants, l'actif coché ; tap = changement d'enfant affiché.
- **Mode enfant** : sa carte (active) et celle de son frère (tap = consultation en lecture seule).
- Menu : Danh sách việc, Mục tiêu, Điểm thưởng, Cài đặt thông báo, Cài đặt chung.
- **Danh sách việc** : toutes les tâches du profil, filtres « À venir / Faites / En retard », recherche par titre **[H]**.

### 3.6 Objectifs (Mục tiêu)
- Pills de profil dans les deux modes (frère en lecture seule côté enfant).
- Carte par objectif : icône, titre, barre de progression, « progression/cible » (ex. 3/5, 4/12).
- « + Thêm mục tiêu » → formulaire : titre, icône/catégorie, cible (entier ≥ 1), unité optionnelle.
- Progression : boutons −/+ (manuel en V1) **[H]**. Objectif atteint = badge + toast, notification au parent.

### 3.7 Points (Điểm thưởng)
- Pills de profil dans les deux modes (frère en lecture seule côté enfant : solde visible, pas de demande possible).
- Carte solde : « 320 điểm — Tổng điểm hiện tại ». Si des demandes sont en attente, ligne secondaire « dont 150 điểm en attente d'approbation ». Tap → historique des mouvements.
- Liste « Đổi điểm lấy phần thưởng » : icône, titre, coût. Récompense dont le coût dépasse le **solde disponible** = grisée.
- Bandeau : « Càng hoàn thành nhiều việc càng có nhiều điểm hơn! ».
- Échange **nécessite le réseau** ; hors ligne, bouton désactivé avec message.

#### Flux d'échange avec approbation parentale
1. **Enfant** : tap sur une récompense → confirmation → **demande créée** (statut `pending`). Les points sont **réservés** : ils sortent du solde disponible mais ne sont pas encore débités.
2. **Parent(s)** : notification push « Minh muốn đổi: Chơi game 1 tiếng (100 điểm) » avec actions rapides Approuver / Refuser ; également dans la file « À approuver » (Điểm thưởng et bannière accueil).
3. **Approuvée** → débit définitif (`reward_redeemed`), push à l'enfant « Đã được duyệt 🎉 ».
   **Refusée** → réservation libérée, push à l'enfant avec motif optionnel.
4. L'enfant peut **annuler** une demande tant qu'elle est en attente.
5. Section « Demandes » sous la liste : en attente / approuvées / refusées (30 derniers jours).
6. Une demande non traitée **expire au bout de 7 jours** (constante, non réglable ; réservation libérée, notification à l'enfant).
7. Avec deux parents, le premier qui traite la demande la clôt ; l'autre voit son statut à jour.
8. **Aucun plafond** : un enfant peut demander la même récompense autant de fois que son solde disponible le permet, y compris plusieurs demandes en attente simultanément.

#### Mode parent
CRUD des récompenses, ajustement manuel (+/− avec motif), file d'approbation.

Récompenses par défaut (créées avec la famille) :
| Récompense | Coût |
|---|---|
| Chơi game 1 tiếng | 100 |
| Xem phim yêu thích | 150 |
| Dùng điện thoại thêm 30 phút | 200 |
| Đồ ăn vặt | 100 |

### 3.8 Statistiques (Thống kê)
- Toggle Tuần / Tháng, pour le profil affiché.
- Anneau : taux de complétion (%).
- Légende : Hoàn thành / Chưa hoàn thành / Tổng số việc.
- « Biểu đồ theo danh mục » : barre horizontale par catégorie (%).
- Carte d'encouragement selon le taux (§5.4).
- Consultable pour le frère en lecture seule, mais **aucun écran ne met les deux enfants côte à côte** (pas de classement, pas de comparatif).

### 3.9 Réglages
- **Notifications** : rappel X min avant le début d'une tâche (défaut 10), avant une échéance (défaut 30), récap du soir. Parent : activité des enfants (tâche faite, récompense échangée, objectif atteint), chacune activable.
- **Général** : langue (vi par défaut, fr, en), déconnexion.
- **Général, mode parent** : gestion des enfants, génération/révocation des codes d'invitation, appareils liés (avec révocation), invitation d'un co-parent, fuseau horaire de la famille, suppression du compte et des données.

---

## 4. Modèle de données (Postgres / Supabase)

Identifiants UUID. Toutes les tables métier portent `family_id`, `created_at`, `updated_at`, `deleted_at` nullable (soft delete, nécessaire à la synchro).

### 4.1 Famille et identités

```sql
families        (id, name, timezone default 'Asia/Ho_Chi_Minh')

children        (id, family_id, name, birth_date, avatar, color, label, sort_order)

members         -- lie un compte auth à une famille
  (id, family_id, user_id → auth.users, role: 'parent' | 'child',
   child_id → children (non null si role = 'child'), display_name)

invite_codes    (id, family_id, child_id?, role, code (6 car.), expires_at, used_at?, created_by)
                -- child_id null + role parent = invitation co-parent

devices         (id, member_id, expo_push_token, platform, last_seen_at, revoked_at?)
```

### 4.2 Données métier

```sql
tasks
  (id, family_id, child_id, title, category, note?,
   date (date, jour local de la famille),
   time_kind ('range'|'deadline'|'anytime'), start_time?, end_time? (time),
   points int default 10,
   completed_at?, completed_by? → members,
   recurrence_id?, created_by → members)
  unique (recurrence_id, date)

recurrences
  (id, family_id, child_id, title, category, note?, time_kind, start_time?, end_time?,
   points, rule ('daily'|'weekdays'), weekdays int[]?, starts_on, ends_on?)

goals            (id, family_id, child_id, title, icon, target ≥ 1, progress ≥ 0, unit?, achieved_at?)

rewards          (id, family_id, title, icon, cost > 0, child_id? (null = commune), sort_order)

point_transactions   -- journal immuable : INSERT uniquement via fonctions, ni UPDATE ni DELETE
  (id (généré côté client → idempotence), family_id, child_id, delta,
   reason ('task_completed'|'task_uncompleted'|'reward_redeemed'|'manual_adjust'),
   ref_id?, note?, created_by, created_at)

reward_requests
  (id (généré côté client), family_id, child_id, reward_id,
   reward_title, cost,               -- copiés à la demande : modifier la récompense ne change pas une demande en cours
   status ('pending'|'approved'|'rejected'|'cancelled'|'expired'),
   requested_by → members, decided_by? → members, decided_at?, decision_note?,
   expires_at, created_at)

activity_log     (id, family_id, child_id, actor_member_id, type, payload jsonb, created_at)
```

Vues :
- `child_balances (child_id, balance, reserved, available)` : `balance = SUM(delta)`, `reserved = SUM(cost)` des demandes `pending`, `available = balance − reserved`.

### 4.3 Catégories (enum Postgres `task_category` + constante côté app)

| Clé | Libellé vi | Icône | Couleur |
|---|---|---|---|
| `study` | Học tập | livre | `#2F80ED` |
| `sport` | Thể thao | haltère | `#8B5CF6` |
| `chores` | Việc nhà | maison | `#F5A623` |
| `personal` | Cá nhân | personne | `#27AE60` |
| `other` | Khác | « … » | `#94A3B8` |

### 4.4 Indexes
`tasks(child_id, date)`, `tasks(family_id, updated_at)`, `point_transactions(child_id, created_at)`, `invite_codes(code)` unique partiel sur codes actifs.

---

## 5. Règles métier

### 5.1 Âge
Calculé à partir de `birth_date` à l'affichage. Jamais stocké.

### 5.2 Points — toujours via fonctions Postgres
Le client n'écrit **jamais** directement dans `point_transactions` ni `tasks.completed_at`. Il appelle des RPC `security definer`, chacune atomique :

| RPC | Effet |
|---|---|
| `complete_task(task_id, tx_id)` | `completed_at = now()` + transaction `+points` ; no-op si déjà faite |
| `uncomplete_task(task_id, tx_id)` | `completed_at = null` + transaction `−points` ; refus si solde deviendrait négatif **[H]** |
| `request_reward(reward_id, request_id)` | enfant, pour lui-même ; refus si `available` < coût ; crée la demande `pending` |
| `cancel_reward_request(request_id)` | enfant auteur ; `pending` → `cancelled` |
| `approve_reward_request(request_id, tx_id)` | parent ; `pending` → `approved` + transaction `−cost` (`reward_redeemed`) |
| `reject_reward_request(request_id, note?)` | parent ; `pending` → `rejected` |
| `adjust_points(child_id, delta, note, tx_id)` | parent uniquement |

- Chaque RPC de demande verrouille la ligne (`SELECT … FOR UPDATE`) : deux parents qui approuvent en même temps ne débitent qu'une fois ; une approbation sur une demande déjà annulée échoue proprement.
- `uncomplete_task` refuse si le **solde disponible** deviendrait négatif (les points réservés sont protégés).
- `pg_cron` horaire : passe en `expired` les demandes `pending` dont `expires_at` est dépassé.

- `tx_id` est généré par le client : rejouer la même requête (file hors ligne, retry réseau) ne crédite jamais deux fois.
- Hors ligne, cocher met à jour l'UI de façon optimiste (tâche cochée, solde projeté) et met l'appel RPC en file d'attente.
- Supprimer une tâche faite ne retire pas les points déjà gagnés **[H]**.

### 5.3 Récurrence (côté serveur) [H]
Générée par une tâche planifiée `pg_cron` quotidienne (minuit, fuseau de la famille) qui matérialise les occurrences sur 14 jours glissants, plus à la création/modification d'une récurrence. L'unicité `(recurrence_id, date)` empêche les doublons. Modifier une récurrence met à jour les occurrences futures non faites. Générer côté serveur évite que deux téléphones créent les mêmes occurrences.

### 5.4 Statistiques
- Semaine = lundi → dimanche, mois = mois civil, **dans le fuseau de la famille**.
- Total = tâches non supprimées dont `date` est dans la période ; Hoàn thành = celles avec `completed_at` ; Chưa hoàn thành = différence.
- Taux = Hoàn thành / Total, arrondi ; « — » si Total = 0.
- Répartition = nb tâches de la catégorie / Total.
- Calcul dans `src/domain/stats.ts` (fonction pure sur les tâches en cache), pour fonctionner hors ligne.
- Message : ≥ 80 % « Xuất sắc! », 50–79 % « Làm tốt lắm! Còn cố gắng hơn nữa nhé! », < 50 % « Cố lên, mỗi ngày một chút! ».

### 5.5 Tâche en retard
Non faite et : `date` passée, ou aujourd'hui avec `end_time` dépassé. Horaire en rouge **[H]**.

### 5.6 Notifications
- **Locales** (expo-notifications), planifiées sur le téléphone de l'enfant pour ses propres rappels ; replanifiées à chaque synchro (une tâche ajoutée par le parent doit déclencher un rappel sur le téléphone de l'enfant).
- **Push** (Expo Push via Edge Function déclenchée par trigger/webhook DB) :
  - enfant → parent(s) : **demande d'échange** (avec actions Approuver / Refuser dans la notification), objectif atteint, récap du soir ;
  - parent → enfant : demande approuvée / refusée / expirée, nouvelle tâche assignée, points ajustés.
- Aucune notification n'est envoyée à un enfant à propos de l'activité de son frère (évite l'effet compétition).
- Les tokens invalides sont nettoyés à la réception des reçus Expo.

### 5.7 Droits (appliqués par RLS, pas seulement dans l'UI)

| Action | Enfant | Parent |
|---|---|---|
| Lire ses tâches, objectifs, solde, récompenses | ✓ | ✓ (tous les enfants) |
| Lire les données de son frère (tâches, objectifs, solde, stats) | ✓ lecture seule | ✓ |
| Lire les notes (`note`) des tâches de son frère | ✓ | ✓ |
| Écrire quoi que ce soit sur le profil de son frère | ✗ | ✓ |
| Demander / annuler un échange | pour lui-même | — |
| Approuver / refuser une demande | ✗ | ✓ |
| Créer une tâche | pour lui-même, points = 10 imposés | pour n'importe quel enfant |
| Modifier / supprimer une tâche | celles qu'il a créées | toutes |
| Cocher / décocher | les siennes (RPC) | toutes (RPC) |
| Objectifs | CRUD sur les siens | CRUD |
| Récompenses | lire, échanger | CRUD |
| Ajuster les points, gérer enfants, codes, appareils | ✗ | ✓ |

### 5.8 Codes d'invitation
6 caractères alphanumériques sans ambiguïté (pas de 0/O, 1/I), valides 24 h, usage unique, consommés via RPC `redeem_invite(code)` qui crée le `member`. Limite de tentatives côté Edge Function (5 / 15 min par appareil). Un parent peut révoquer un appareil : l'enfant est déconnecté et doit re-scanner un code.

### 5.9 Conflits de synchronisation
- Champs éditables (titre, horaire, note, objectif) : dernière écriture gagne sur `updated_at` serveur.
- Complétion et points : jamais en conflit, car sérialisés par les RPC idempotentes.
- Tâche supprimée par le parent pendant que l'enfant la coche hors ligne : la RPC échoue proprement, l'UI retire la tâche avec un toast.

---

## 6. Choix techniques

| Domaine | Choix | Raison |
|---|---|---|
| App | **Expo (dernier SDK stable) + React Native + TypeScript strict** | iOS + Android, une base |
| Navigation | **Expo Router** | Tabs, modales, deep links (`taskmate://join?code=…`) |
| Backend | **Supabase** : Postgres, Auth, Realtime, Edge Functions, `pg_cron` | Tout le nécessaire sans serveur à maintenir ; RLS pour les droits |
| Auth parent | Email OTP + Sign in with Apple + Google | Pas de mot de passe à gérer |
| Auth enfant | **Session anonyme Supabase** liée au profil via code d'invitation | Un enfant de 13 ans n'a pas forcément d'email |
| Données client | **TanStack Query** + persistance (MMKV) + mutations en pause hors ligne | Cache offline, file de mutations, invalidation simple |
| Temps réel | Supabase Realtime (canal par famille) → invalidation des queries | Coche de l'enfant visible chez le parent en quelques secondes |
| Stockage local | **react-native-mmkv** (cache queries, préférences) ; `expo-secure-store` pour la session | Rapide, synchrone |
| Types DB | `supabase gen types typescript` → `src/types/db.ts` | Typage bout en bout |
| Validation | **zod** (formulaires + payloads RPC) + react-hook-form | |
| Dates | **date-fns** + `date-fns-tz` + locale `vi` | Fuseau de la famille, format vietnamien |
| Graphiques | **react-native-svg**, composants maison | Anneau + barres, pas de lib lourde |
| Icônes | **lucide-react-native** | |
| i18n | **i18next + react-i18next + expo-localization** | vi par défaut, fr/en |
| Notifications | **expo-notifications** (local + push via Expo Push) | |
| QR | **expo-camera** (scan) + `react-native-qrcode-svg` (affichage) | Jumelage enfant |
| Tests | Jest + RNTL (app) ; **pgTAP via `supabase test db`** (RLS + RPC) ; **Maestro** (E2E) | Les règles de sécurité sont testées en SQL |
| Qualité / CI | ESLint, Prettier, `tsc --noEmit`, GitHub Actions (lint, tests, `supabase db lint`) | |
| Build / OTA | EAS Build + EAS Update | Correctifs sans passer par les stores |

**Alternative écartée** : local-first complet (PowerSync, ElectricSQL) — plus robuste hors ligne mais coût et complexité disproportionnés pour une famille et quelques centaines de tâches. Le modèle (UUID, soft delete, `updated_at`) permet d'y migrer plus tard.

### 6.1 Structure du repo (monorepo simple)

```
apps/mobile/
  app/                      # Expo Router — écrans uniquement
    _layout.tsx
    index.tsx               # splash / routage selon session et rôle
    onboarding/ (role.tsx, parent-auth.tsx, family.tsx, children.tsx, join.tsx)
    (tabs)/ (today.tsx, calendar.tsx, stats.tsx, more/…)
    task/new.tsx, task/[id].tsx
  src/
    domain/                 # logique pure testée : stats, task-time, age, balance projetée
    api/                    # client Supabase, wrappers RPC typés, query keys
    hooks/                  # useTodayTasks, useBalance, useStats, useRealtimeFamily…
    sync/                   # persistance TanStack, file de mutations, état réseau
    services/notifications.ts
    store/session.ts        # rôle, member, enfant affiché
    components/  theme/  i18n/  types/db.ts
  e2e/                      # flows Maestro
supabase/
  migrations/               # schéma, RLS, RPC, triggers, pg_cron
  functions/
    redeem-invite/
    send-push/
  tests/                    # pgTAP : RLS et RPC
  seed.sql                  # famille de démo : Minh 17 ans, Khang 13 ans
```

Règles pour Claude Code :
- Les écrans appellent des hooks ; les hooks passent par `src/api` ; les calculs vivent dans `src/domain`.
- Toute opération sur les points passe par une RPC, jamais par un `insert`/`update` direct.
- Toute nouvelle table : RLS activée dans la même migration + tests pgTAP.
- Aucune chaîne d'UI en dur. Aucun secret dans l'app (seulement l'URL et la clé `anon`).
- Dates : `date` = jour local de la famille ; ne jamais dériver le jour d'une tâche d'un timestamp UTC.

### 6.2 Design tokens (extraits des maquettes)
- Primaire `#1E88F5` (boutons, pills actives, FAB) ; aîné bleu, cadet vert menthe `#2EC4A6`.
- Fond `#F5F8FC` ; cartes blanches, rayon 16, ombre légère.
- Cartes calendrier : couleur de catégorie à ~12 % d'opacité.
- Typo système : titres 22 semibold, corps 15, secondaire 13 `#8A94A6`.

---

## 7. Plan de livraison (jalons pour Claude Code)

Chaque jalon se termine par : `tsc` propre, lint propre, tests app + pgTAP verts, app qui démarre sur simulateur contre Supabase local (`supabase start`).

1. **M0 — Squelette** : monorepo, Expo TS + Router, Supabase local, theme, i18n, CI, CLAUDE.md.
2. **M1 — Schéma & sécurité** : migrations (familles, membres, enfants, tâches, objectifs, récompenses, transactions), RLS complète, RPC points, tests pgTAP de chaque règle du §5.7.
3. **M2 — Onboarding & auth** : parent (OTP/Apple/Google), création famille + enfants, codes/QR, jointure enfant en session anonyme, routage par rôle.
4. **M3 — Accueil + tâches** : liste du jour, cocher/décocher via RPC, anneau, formulaire Thêm việc, droits enfant/parent.
5. **M4 — Hors ligne & temps réel** : persistance TanStack + MMKV, file de mutations, indicateurs de synchro, Realtime par famille.
6. **M5 — Calendrier** : bandeau semaine, navigation, cartes, vue semaine.
7. **M6 — Points & récompenses** : solde (disponible / réservé), demandes d'échange, file d'approbation parent, expiration, historique, CRUD parent, ajustement manuel. Actions dans les notifications en M9.
8. **M7 — Objectifs**.
9. **M8 — Statistiques** : `domain/stats.ts` testé, vues semaine/mois.
10. **M9 — Notifications** : rappels locaux replanifiés à la synchro, push via Edge Function, réglages.
11. **M10 — Récurrence** : table, `pg_cron`, génération idempotente, tests.
12. **M11 — Finition** : mode parent complet (appareils, co-parent), états vides, accessibilité, flows Maestro, build EAS, politique de confidentialité.

---

## 8. Critères d'acceptation clés

- Minh coche une tâche sur son téléphone → elle apparaît cochée chez le parent en moins de 5 s (réseau normal).
- Cocher hors ligne puis revenir en ligne crédite les points **une seule fois**, même après plusieurs retries.
- Un enfant peut lire les données de son frère mais ne peut rien y écrire (ni cocher, ni créer, ni demander d'échange), ne peut pas s'attribuer de points ni modifier `points` d'une tâche — vérifié par tests pgTAP, pas seulement par l'UI.
- Une demande d'échange réserve les points sans les débiter ; seule l'approbation d'un parent crée la transaction `reward_redeemed`.
- Deux demandes simultanées dont le total dépasse le solde disponible : la seconde est refusée côté serveur.
- Deux parents approuvant la même demande en même temps : un seul débit.
- Refus, annulation ou expiration : le solde disponible revient à sa valeur d'avant la demande.
- Aucun écran n'affiche les deux enfants côte à côte ni de classement.
- Une tâche créée par le parent pour 20:00 déclenche un rappel local sur le téléphone de l'enfant.
- Un appareil révoqué perd l'accès à sa prochaine requête.
- Le jour affiché dans le calendrier correspond au jour réel (les maquettes contiennent une incohérence : « Thứ Tư » sous la colonne T5).
- Les statistiques d'une période vide affichent « — » et pas « NaN % ».
- Couverture ≥ 90 % sur `src/domain/` ; chaque politique RLS a au moins un test positif et un négatif.

---

## 9. Hypothèses et questions ouvertes

Les valeurs par défaut ci-dessus s'appliquent tant que rien n'est décidé.

Tranchées :
- Coche libre des tâches, points immédiats.
- Échange soumis à approbation parentale.
- Frères visibles en lecture seule, sans classement.
- **Aucun plafond** d'échange par récompense (pas de limite de fréquence).
- Expiration des demandes **fixe à 7 jours**, non réglable.
- **Pas de notes privées** : toutes les notes sont visibles par le frère.

Encore ouvertes :

1. **Le parent a-t-il l'app ?** Hypothèse : oui, en mode parent sur son téléphone — indispensable pour approuver les échanges.
2. **Points par tâche** : 10 par défaut, modifiables par le parent seul (hypothèse) — ou barème par catégorie/durée ?
3. **Objectifs** : progression manuelle (V1) ou automatique quand une tâche de la catégorie est cochée ?
4. **Langue** : vietnamien uniquement ou bilingue ?
5. **Données de mineurs** : hébergement Supabase (région Singapour recommandée pour la latence depuis le Vietnam) ; politique de confidentialité et suppression de compte requises par l'App Store / Play Store.
