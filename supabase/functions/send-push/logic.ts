// Logique pure de l'Edge Function `send-push` (SPEC §5.6) — sans API Deno, donc testable avec Jest.

// ───────────────────────── Textes (D-063) ─────────────────────────

/** Langue des notifications (D-063) : vietnamien par défaut (SPEC §3.9), français, anglais. Vient de `devices.locale`, réglée par l'app (RPC `set_push_locale`). */
export type Locale = 'vi' | 'fr' | 'en';
export const DEFAULT_LOCALE: Locale = 'vi';

/** Toute valeur inconnue ou absente retombe sur le vietnamien (jamais d'erreur pour une notification). */
export const toLocale = (v: unknown): Locale => (v === 'fr' || v === 'en' || v === 'vi' ? v : DEFAULT_LOCALE);

type TextVars = { child: string; title: string; count: number; points: number; cost: number | string; delta: number; note: string; subject: string };

type Catalog = {
  taskDoneMany: (v: TextVars) => string;
  taskDone: (v: TextVars) => string;
  taskValidated: (v: TextVars) => string;
  taskRejected: (v: TextVars) => string;
  rewardRequested: (v: TextVars) => string;
  goalAchieved: (v: TextVars) => string;
  rewardApproved: (v: TextVars) => string;
  rewardRejected: (v: TextVars) => string;
  rewardExpired: (v: TextVars) => string;
  pointsAdjusted: (v: TextVars) => string;
  taskAssigned: (v: TextVars) => string;
  quizDoneMany: (v: TextVars) => string;
  quizDone: (v: TextVars) => string;
  quizValidated: (v: TextVars) => string;
  quizValidatedNoPoints: (v: TextVars) => string;
  testNotification: string;
  recapTitle: string;
  recapLine: (name: string, done: number, total: number) => string;
  recapWaiting: (count: number) => string;
  recapQuizzes: (count: number) => string;
  reminderStart: (minutes: number, time: string) => string;
  reminderDeadline: (minutes: number, time: string) => string;
};

const withNote = (note: string) => (note ? ` — ${note}` : '');
const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`;

const CATALOGS: Record<Locale, Catalog> = {
  vi: {
    taskDoneMany: (v) => `${v.child} đã hoàn thành ${v.count} việc — chờ duyệt`,
    taskDone: (v) => `${v.child} đã hoàn thành: ${v.title} — chờ duyệt`,
    taskValidated: (v) => `Đã được duyệt 🎉 ${v.title} (+${v.points} điểm)`,
    taskRejected: (v) => `Việc bị từ chối: ${v.title}${withNote(v.note)}`,
    rewardRequested: (v) => `${v.child} muốn đổi: ${v.title} (${v.cost} điểm)`,
    goalAchieved: (v) => `${v.child} đã đạt mục tiêu: ${v.title}`,
    rewardApproved: (v) => `Đã được duyệt 🎉 ${v.title}`,
    rewardRejected: (v) => `Yêu cầu bị từ chối: ${v.title}${withNote(v.note)}`,
    rewardExpired: (v) => `Yêu cầu đã hết hạn: ${v.title}`,
    pointsAdjusted: (v) => `Điểm của bạn được điều chỉnh ${signed(v.delta)}`,
    taskAssigned: (v) => `Việc mới: ${v.title}`,
    quizDoneMany: (v) => `${v.child} đã làm xong ${v.count} bài ôn tập — cần duyệt`,
    quizDone: (v) => `${v.child} đã làm xong bài ôn tập ${v.subject} — cần duyệt`,
    quizValidated: (v) => `Bài ôn tập đã được duyệt · +${v.points} điểm`,
    quizValidatedNoPoints: () => 'Bài ôn tập đã được duyệt',
    testNotification: 'Thông báo thử — thiết bị này nhận được thông báo ✅',
    recapTitle: 'Tổng kết hôm nay',
    recapLine: (name, done, total) => `${name}: ${done}/${total} việc`,
    recapWaiting: (count) => `${count} mục chờ duyệt`,
    recapQuizzes: (count) => `${count} bài ôn tập chờ duyệt`,
    reminderStart: (minutes, time) => `Bắt đầu lúc ${time} (còn ${minutes} phút)`,
    reminderDeadline: (minutes, time) => `Hạn chót ${time} (còn ${minutes} phút)`,
  },
  fr: {
    taskDoneMany: (v) => `${v.child} a terminé ${v.count} tâches — à valider`,
    taskDone: (v) => `${v.child} a terminé : ${v.title} — à valider`,
    taskValidated: (v) => `Validée 🎉 ${v.title} (+${v.points} points)`,
    taskRejected: (v) => `Tâche refusée : ${v.title}${withNote(v.note)}`,
    rewardRequested: (v) => `${v.child} veut échanger : ${v.title} (${v.cost} points)`,
    goalAchieved: (v) => `${v.child} a atteint son objectif : ${v.title}`,
    rewardApproved: (v) => `Acceptée 🎉 ${v.title}`,
    rewardRejected: (v) => `Demande refusée : ${v.title}${withNote(v.note)}`,
    rewardExpired: (v) => `Demande expirée : ${v.title}`,
    pointsAdjusted: (v) => `Tes points ont été ajustés ${signed(v.delta)}`,
    taskAssigned: (v) => `Nouvelle tâche : ${v.title}`,
    quizDoneMany: (v) => `${v.child} a terminé ${v.count} quiz — à valider`,
    quizDone: (v) => `${v.child} a terminé le quiz « ${v.subject} » — à valider`,
    quizValidated: (v) => `Quiz validé · +${v.points} points`,
    quizValidatedNoPoints: () => 'Quiz validé',
    testNotification: 'Notification de test — cet appareil reçoit bien les notifications ✅',
    recapTitle: "Bilan d'aujourd'hui",
    recapLine: (name, done, total) => `${name} : ${done}/${total} tâches`,
    recapWaiting: (count) => `${count} à valider`,
    recapQuizzes: (count) => `${count} quiz à valider`,
    reminderStart: (minutes, time) => `Début à ${time} (dans ${minutes} min)`,
    reminderDeadline: (minutes, time) => `À finir avant ${time} (dans ${minutes} min)`,
  },
  en: {
    taskDoneMany: (v) => `${v.child} finished ${v.count} tasks — waiting for approval`,
    taskDone: (v) => `${v.child} finished: ${v.title} — waiting for approval`,
    taskValidated: (v) => `Approved 🎉 ${v.title} (+${v.points} points)`,
    taskRejected: (v) => `Task declined: ${v.title}${withNote(v.note)}`,
    rewardRequested: (v) => `${v.child} wants to redeem: ${v.title} (${v.cost} points)`,
    goalAchieved: (v) => `${v.child} reached a goal: ${v.title}`,
    rewardApproved: (v) => `Approved 🎉 ${v.title}`,
    rewardRejected: (v) => `Request declined: ${v.title}${withNote(v.note)}`,
    rewardExpired: (v) => `Request expired: ${v.title}`,
    pointsAdjusted: (v) => `Your points were adjusted ${signed(v.delta)}`,
    taskAssigned: (v) => `New task: ${v.title}`,
    quizDoneMany: (v) => `${v.child} finished ${v.count} quizzes — waiting for approval`,
    quizDone: (v) => `${v.child} finished the ${v.subject} quiz — waiting for approval`,
    quizValidated: (v) => `Review approved · +${v.points} points`,
    quizValidatedNoPoints: () => 'Review approved',
    testNotification: 'Test notification — this device receives notifications ✅',
    recapTitle: "Today's summary",
    recapLine: (name, done, total) => `${name}: ${done}/${total} tasks`,
    recapWaiting: (count) => `${count} waiting for approval`,
    recapQuizzes: (count) => `${count} quizzes waiting for approval`,
    reminderStart: (minutes, time) => `Starts at ${time} (in ${minutes} min)`,
    reminderDeadline: (minutes, time) => `Due before ${time} (in ${minutes} min)`,
  },
};

const catalogFor = (locale: Locale): Catalog => CATALOGS[locale];

/** Matières du catalogue (clés stables, comme `domain/catalog.ts`) dans la langue de l'appareil ; une clé inconnue (jeu de la famille : texte libre) s'affiche telle quelle. */
const SUBJECT_LABELS: Record<Locale, Record<string, string>> = {
  vi: { hist_geo: 'Lịch sử và Địa lý', maths: 'Toán', langue_nationale: 'Ngôn ngữ quốc gia', anglais: 'Tiếng Anh', sciences: 'Khoa học', civics: 'Giáo dục công dân', technology: 'Công nghệ' },
  fr: { hist_geo: 'Histoire-Géographie', maths: 'Mathématiques', langue_nationale: 'Langue nationale', anglais: 'Anglais', sciences: 'Sciences', civics: 'Éducation civique', technology: 'Technologie' },
  en: { hist_geo: 'History & Geography', maths: 'Mathematics', langue_nationale: 'National language', anglais: 'English', sciences: 'Science', civics: 'Civics', technology: 'Technology' },
};
export const subjectLabel = (locale: Locale, key: string): string => SUBJECT_LABELS[locale][key] ?? key;

// ───────────────────────── Destinataires et messages ─────────────────────────

export type ActivityRecord = {
  id: string;
  family_id: string;
  child_id: string | null;
  actor_member_id: string | null;
  type: string;
  payload: Record<string, unknown> | null;
};
export type MemberInfo = {
  id: string;
  role: 'parent' | 'child';
  child_id: string | null;
  display_name: string;
  prefs: unknown;
};
export type WebPushSubscription = { endpoint: string; keys: { p256dh: string; auth: string }; expirationTime?: number | null };
/** `locale` : langue des notifications de l'appareil (D-063) ; absente ou inconnue = vietnamien. */
export type DeviceInfo = { id?: string; member_id: string; expo_push_token: string | null; web_push_subscription?: WebPushSubscription | null; locale?: string | null };
export type PushMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: 'default';
  channelId: 'default';
  categoryId?: string;
  collapseId?: string;
};

const PARENT_TYPES = new Set(['task_completed', 'reward_requested', 'goal_achieved', 'quiz_submitted']);
const CHILD_TYPES = new Set(['task_validated', 'task_rejected', 'reward_approved', 'reward_rejected', 'reward_expired', 'points_adjusted', 'task_assigned', 'quiz_validated']);

type PrefKey = 'taskDone' | 'rewardRequested' | 'goalAchieved' | 'quizSubmitted' | 'quizValidated';
/** Préférence absente (anciens `notification_prefs`) = activée. */
const activityPref = (prefs: unknown, key: PrefKey): boolean => {
  const activity = (prefs as { activity?: Record<string, unknown> } | null)?.activity;
  return activity?.[key] !== false; // activé par défaut
};

const PARENT_PREF: Record<string, PrefKey> = {
  task_completed: 'taskDone',
  reward_requested: 'rewardRequested',
  goal_achieved: 'goalAchieved',
  quiz_submitted: 'quizSubmitted',
};
/** Seules préférences d'un ENFANT qui coupent une notification d'activité (les autres décisions du parent lui parviennent toujours). */
const CHILD_PREF: Record<string, PrefKey> = { quiz_validated: 'quizValidated' };

export type Skipped = { noRecipient: number; noDevice: number; prefOff: number; noVapid: number };

/**
 * Destinataires d'une activité :
 *  - enfant → parent(s) : tâche faite, demande d'échange, objectif atteint, quiz terminé (selon leurs préférences) ;
 *  - parent → enfant CONCERNÉ uniquement : décision sur une demande, points ajustés, nouvelle tâche, quiz validé (préférence de l'enfant).
 * Jamais de notification à un enfant à propos de l'activité de son frère (SPEC §5.6).
 * ET pourquoi personne ne reçoit : `noRecipient` (aucun destinataire possible : par exemple l'acteur est le seul parent), `prefOff` (destinataires
 * qui ont coupé ce type), `noDevice` (destinataires sans aucun appareil enregistré). `noVapid` est complété par la fonction (Web Push sans clés).
 */
export function explainDelivery(
  activity: ActivityRecord,
  members: readonly MemberInfo[],
  devices: readonly DeviceInfo[] = [],
): { recipients: MemberInfo[]; skipped: Omit<Skipped, 'noVapid'> } {
  const notActor = (m: MemberInfo) => m.id !== activity.actor_member_id;
  let candidates: MemberInfo[] = [];
  let wanted: (m: MemberInfo) => boolean = () => true;
  if (PARENT_TYPES.has(activity.type)) {
    candidates = members.filter((m) => m.role === 'parent' && notActor(m));
    const key = PARENT_PREF[activity.type] as PrefKey;
    wanted = (m) => activityPref(m.prefs, key);
  } else if (CHILD_TYPES.has(activity.type)) {
    candidates = members.filter((m) => m.role === 'child' && m.child_id !== null && m.child_id === activity.child_id && notActor(m));
    const key = CHILD_PREF[activity.type];
    if (key) wanted = (m) => activityPref(m.prefs, key);
  }
  const recipients = candidates.filter(wanted);
  const hasDevice = (m: MemberInfo) => devices.some((d) => d.member_id === m.id && (d.expo_push_token || d.web_push_subscription?.endpoint));
  return {
    recipients,
    skipped: { noRecipient: candidates.length === 0 ? 1 : 0, prefOff: candidates.length - recipients.length, noDevice: recipients.filter((m) => !hasDevice(m)).length },
  };
}

export const recipientsFor = (activity: ActivityRecord, members: readonly MemberInfo[]): MemberInfo[] => explainDelivery(activity, members).recipients;

type Text = { title: string; body: string };

/** Texte d'une activité dans la langue de l'appareil destinataire (vietnamien par défaut, D-063). */
export function textFor(activity: ActivityRecord, childName: string, groupedCount = 1, locale: Locale = 'vi'): Text | null {
  const p = (activity.payload ?? {}) as { title?: string; cost?: number; delta?: number; note?: string; points?: number; subject?: string };
  const v: TextVars = {
    child: childName,
    title: p.title ?? '',
    count: groupedCount,
    points: p.points ?? 0,
    cost: p.cost ?? '',
    delta: p.delta ?? 0,
    note: p.note ?? '',
    subject: p.subject ? subjectLabel(locale, p.subject) : (p.title ?? ''),
  };
  const c = catalogFor(locale);
  const body = (text: string): Text => ({ title: 'TaskMate', body: text });
  switch (activity.type) {
    case 'task_completed':
      // tâche cochée À VALIDER ; plusieurs coches en moins de 10 min → une seule notification groupée (§5.6)
      return body(groupedCount > 1 ? c.taskDoneMany(v) : c.taskDone(v));
    case 'task_validated':
      return body(c.taskValidated(v));
    case 'task_rejected':
      return body(c.taskRejected(v));
    case 'reward_requested':
      return body(c.rewardRequested(v));
    case 'goal_achieved':
      return body(c.goalAchieved(v));
    case 'reward_approved':
      return body(c.rewardApproved(v));
    case 'reward_rejected':
      return body(c.rewardRejected(v));
    case 'reward_expired':
      return body(c.rewardExpired(v));
    case 'points_adjusted':
      return body(c.pointsAdjusted(v));
    case 'task_assigned':
      return body(c.taskAssigned(v));
    case 'quiz_submitted':
      // plusieurs quiz terminés d'affilée (10 min) → une seule notification groupée
      return body(groupedCount > 1 ? c.quizDoneMany(v) : c.quizDone(v));
    case 'quiz_validated':
      return body(v.points > 0 ? c.quizValidated(v) : c.quizValidatedNoPoints(v));
    default:
      return null;
  }
}

/** Récap du soir : une ligne par enfant + éléments en attente, dans la langue donnée. `null` si rien à dire. */
export function recapText(
  summary: readonly { name: string; done: number; total: number }[],
  pending: { tasks: number; requests: number; quizzes?: number },
  locale: Locale = 'vi',
): Text | null {
  const c = catalogFor(locale);
  const lines = summary.filter((s) => s.total > 0).map((s) => c.recapLine(s.name, s.done, s.total));
  const waiting = pending.tasks + pending.requests;
  if (waiting > 0) lines.push(c.recapWaiting(waiting));
  if ((pending.quizzes ?? 0) > 0) lines.push(c.recapQuizzes(pending.quizzes as number));
  if (lines.length === 0) return null;
  return { title: c.recapTitle, body: lines.join(' · ') };
}

/** Fenêtre de regroupement des coches (SPEC §5.6). */
export const GROUP_WINDOW_MS = 10 * 60 * 1000;

/** Nombre d'événements du même type d'un enfant dans la fenêtre de 10 min (l'activité courante comprise) : coches de tâches ou quiz terminés. */
export function countGroupedCompletions(activity: ActivityRecord & { created_at?: string }, recent: readonly { created_at: string }[]): number {
  const at = activity.created_at ? new Date(activity.created_at).getTime() : Date.now();
  const inWindow = recent.filter((r) => at - new Date(r.created_at).getTime() <= GROUP_WINDOW_MS && new Date(r.created_at).getTime() <= at);
  return Math.max(1, inWindow.length);
}

export function buildMessages(
  activity: ActivityRecord,
  members: readonly MemberInfo[],
  devices: readonly DeviceInfo[],
  childName: string,
  groupedCount = 1,
): PushMessage[] {
  if (!textFor(activity, childName, groupedCount)) return [];
  const p = (activity.payload ?? {}) as { request_id?: string; task_id?: string; quiz_id?: string; attempt_id?: string };
  const data: Record<string, unknown> = {
    type: activity.type,
    childId: activity.child_id,
    ...(p.request_id ? { requestId: p.request_id } : {}),
    // D-089 : le parent ouvre le détail de CE quiz (D-088 : « Cần duyệt »)
    ...(activity.type === 'quiz_submitted' && typeof p.quiz_id === 'string' ? { quizId: p.quiz_id } : {}),
    ...(activity.type === 'quiz_submitted' && typeof p.attempt_id === 'string' ? { attemptId: p.attempt_id } : {}),
    // une seule tâche à valider → boutons Duyệt / Từ chối directement dans la notification
    ...(activity.type === 'task_completed' && groupedCount <= 1 && p.task_id ? { taskId: p.task_id } : {}),
  };
  const messages: PushMessage[] = [];
  for (const member of recipientsFor(activity, members)) {
    for (const d of devices) {
      if (d.member_id !== member.id || !d.expo_push_token) continue;
      messages.push({
        to: d.expo_push_token,
        // texte dans la langue de CET appareil (D-063)
        ...(textFor(activity, childName, groupedCount, toLocale(d.locale)) as Text),
        data,
        sound: 'default',
        channelId: 'default',
        // la demande d'échange propose Approuver / Refuser directement dans la notification (§3.7)
        ...(activity.type === 'reward_requested' ? { categoryId: 'reward_request' } : {}),
        ...(activity.type === 'task_completed' && groupedCount <= 1 ? { categoryId: 'task_validation' } : {}),
        // regroupement : la notification suivante remplace la précédente (iOS : collapse-id ; Android : même tag)
        ...(activity.type === 'task_completed' ? { collapseId: `tasks-${activity.child_id}` } : {}),
        ...(activity.type === 'quiz_submitted' ? { collapseId: `quizzes-${activity.child_id}` } : {}),
      });
    }
  }
  return messages;
}

/** Récap du soir pour les parents : une ligne par enfant « Minh: 3/5 việc » + éléments en attente de décision (tâches, échanges), dans la langue de chaque appareil. */
export function buildRecapMessages(
  parents: readonly MemberInfo[],
  devices: readonly DeviceInfo[],
  summary: readonly { name: string; done: number; total: number }[],
  pending: { tasks: number; requests: number; quizzes?: number } = { tasks: 0, requests: 0 },
): PushMessage[] {
  const out: PushMessage[] = [];
  for (const parent of parents) {
    for (const d of devices) {
      if (d.member_id !== parent.id || !d.expo_push_token) continue;
      const text = recapText(summary, pending, toLocale(d.locale));
      if (text) out.push({ to: d.expo_push_token, ...text, data: { type: 'evening_recap' }, sound: 'default', channelId: 'default' });
    }
  }
  return out;
}

export type ExpoTicket = { status: 'ok'; id: string } | { status: 'error'; message?: string; details?: { error?: string } };

/** Jetons à nettoyer : l'appareil n'est plus enregistré chez Expo (« DeviceNotRegistered »). Tickets alignés sur les messages. */
export function tokensToRemove(messages: readonly PushMessage[], tickets: readonly ExpoTicket[]): string[] {
  const out: string[] = [];
  tickets.forEach((t, i) => {
    if (t.status === 'error' && t.details?.error === 'DeviceNotRegistered' && messages[i]) out.push(messages[i].to);
  });
  return [...new Set(out)];
}

export const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};


// ───────────────────────── Web Push (W3) ─────────────────────────

export type WebPushPayload = { title: string; body: string; data: Record<string, unknown>; tag?: string; url: string };
export type WebPushMessage = { subscription: WebPushSubscription; payload: WebPushPayload };

/** Page ouverte au clic sur la notification (le service worker ne porte aucune session : pas de boutons d'action). */
export function urlForType(type: string, childId: string | null = null, payload: Record<string, unknown> | null = null): string {
  switch (type) {
    case 'task_completed':
    case 'reward_requested':
      return '/approvals';
    case 'quiz_submitted':
      // D-089 : le détail de CE quiz pour CET enfant (le parent y valide) ; l'écran retombe sur la validation d'une tentative d'un jeu de famille
      // via `attempt`. Sans identifiant de quiz (ancienne ligne), l'écran Ôn tập de l'enfant.
      if (childId && typeof payload?.quiz_id === 'string') {
        const attempt = typeof payload.attempt_id === 'string' ? `&attempt=${encodeURIComponent(payload.attempt_id)}` : '';
        return `/quiz/detail?child=${encodeURIComponent(childId)}&quiz=${encodeURIComponent(payload.quiz_id)}${attempt}`;
      }
      return childId ? `/weekly?child=${encodeURIComponent(childId)}` : '/weekly';
    case 'quiz_validated':
      return '/weekly';
    case 'goal_achieved':
      return '/more/goals';
    case 'reward_approved':
    case 'reward_rejected':
    case 'reward_expired':
    case 'points_adjusted':
      return '/more/points';
    default:
      return '/';
  }
}

const webDevicesOf = (devices: readonly DeviceInfo[], memberId: string) =>
  devices.filter((d) => d.member_id === memberId && d.web_push_subscription?.endpoint);

/** Mêmes destinataires et mêmes textes que les push mobiles (préférences comprises), pour les navigateurs abonnés. */
export function buildWebMessages(
  activity: ActivityRecord,
  members: readonly MemberInfo[],
  devices: readonly DeviceInfo[],
  childName: string,
  groupedCount = 1,
): WebPushMessage[] {
  if (!textFor(activity, childName, groupedCount)) return [];
  const data = { type: activity.type, childId: activity.child_id };
  const out: WebPushMessage[] = [];
  for (const member of recipientsFor(activity, members)) {
    for (const d of webDevicesOf(devices, member.id)) {
      out.push({
        subscription: d.web_push_subscription as WebPushSubscription,
        payload: {
          ...(textFor(activity, childName, groupedCount, toLocale(d.locale)) as Text),
          data,
          url: urlForType(activity.type, activity.child_id, activity.payload),
          // les coches groupées d'un enfant se remplacent (même tag)
          ...(activity.type === 'task_completed' ? { tag: `tasks-${activity.child_id}` } : {}),
          ...(activity.type === 'quiz_submitted' ? { tag: `quizzes-${activity.child_id}` } : {}),
        },
      });
    }
  }
  return out;
}

export function buildWebRecapMessages(
  parents: readonly MemberInfo[],
  devices: readonly DeviceInfo[],
  summary: readonly { name: string; done: number; total: number }[],
  pending: { tasks: number; requests: number; quizzes?: number } = { tasks: 0, requests: 0 },
): WebPushMessage[] {
  const waiting = pending.tasks + pending.requests;
  return parents.flatMap((parent) =>
    webDevicesOf(devices, parent.id).flatMap((d) => {
      const text = recapText(summary, pending, toLocale(d.locale));
      if (!text) return [];
      return [{ subscription: d.web_push_subscription as WebPushSubscription, payload: { ...text, data: { type: 'evening_recap' }, url: waiting > 0 ? '/approvals' : (pending.quizzes ?? 0) > 0 ? '/weekly' : '/' } }];
    }),
  );
}

/** Abonnements à supprimer : le service push répond 404/410 (« Gone ») quand le navigateur s'est désabonné. */
export function deadEndpoints(results: readonly { endpoint: string; statusCode?: number }[]): string[] {
  return [...new Set(results.filter((r) => r.statusCode === 404 || r.statusCode === 410).map((r) => r.endpoint))];
}


// ───────────────────────── Diagnostic d'envoi (D-088) ─────────────────────────

/** Résultat d'un envoi Web Push, tel que mémorisé sur l'appareil (`devices.last_push_result`) : `sent`, `gone` (404/410) ou `failed:<code>`. */
export function webResultLabel(statusCode?: number): string {
  if (statusCode === undefined) return 'sent';
  return statusCode === 404 || statusCode === 410 ? 'gone' : `failed:${statusCode}`;
}
/** Idem pour un jeton Expo : `sent` ou `error:<code>`. */
export function expoResultLabel(ticket: ExpoTicket | undefined): string {
  if (!ticket) return 'error:no_ticket';
  return ticket.status === 'ok' ? 'sent' : `error:${ticket.details?.error ?? 'unknown'}`.slice(0, 80);
}

/** Message de test (« Gửi thông báo thử ») pour les appareils d'UN membre : un seul navigateur si `endpoint` est donné. Même langue que l'appareil. */
export function buildTestMessages(devices: readonly DeviceInfo[], memberId: string, endpoint?: string | null): { expo: PushMessage[]; web: WebPushMessage[] } {
  const mine = devices.filter((d) => d.member_id === memberId);
  const expo = endpoint
    ? []
    : mine
        .filter((d) => d.expo_push_token)
        .map((d): PushMessage => ({ to: d.expo_push_token as string, title: 'TaskMate', body: catalogFor(toLocale(d.locale)).testNotification, data: { type: 'test' }, sound: 'default', channelId: 'default' }));
  const web = mine
    .filter((d) => d.web_push_subscription?.endpoint && (!endpoint || d.web_push_subscription.endpoint === endpoint))
    .map((d): WebPushMessage => ({
      subscription: d.web_push_subscription as WebPushSubscription,
      payload: { title: 'TaskMate', body: catalogFor(toLocale(d.locale)).testNotification, data: { type: 'test' }, url: '/', tag: 'test' },
    }));
  return { expo, web };
}


// ───────────────────────── Tâches planifiées (D-099) ─────────────────────────
// `pg_cron` appelle `send-push` toutes les 15 min (récap du soir des parents) et toutes les 5 min (rappels des tâches de l'enfant). Tout est calculé ICI
// dans le fuseau de la famille : le jour d'une tâche est un jour LOCAL, jamais dérivé d'un instant UTC.

export const RECAP_TICK_MS = 15 * 60_000;
export const REMINDER_TICK_MS = 5 * 60_000;
const MAX_REMINDER_MIN = 240;

const dtf = (timeZone: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** Date locale (`YYYY-MM-DD`) et minutes depuis minuit d'un instant, dans un fuseau IANA (lève `RangeError` si le fuseau est inconnu). */
export function localParts(at: Date, timeZone: string): { date: string; minutes: number } {
  const parts = dtf(timeZone).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

function offsetMs(at: Date, timeZone: string): number {
  const parts = dtf(timeZone).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Instant (UTC) correspondant à « ce jour, cette heure » DANS le fuseau de la famille (heure d'été comprise). */
export function zonedInstant(date: string, time: string, timeZone: string): Date {
  const wall = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)), Number(time.slice(0, 2)), Number(time.slice(3, 5)));
  const first = wall - offsetMs(new Date(wall), timeZone);
  return new Date(wall - offsetMs(new Date(first), timeZone));
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Récap du soir d'un parent : activé par défaut à 20:30 (mêmes valeurs par défaut que l'app, `DEFAULT_PREFS`). */
export function recapSettings(prefs: unknown): { enabled: boolean; time: string } {
  const r = (prefs as { eveningRecap?: { enabled?: unknown; time?: unknown } } | null)?.eveningRecap;
  return { enabled: typeof r?.enabled === 'boolean' ? r.enabled : true, time: typeof r?.time === 'string' && TIME_RE.test(r.time) ? r.time : '20:30' };
}

/** Le récap de ce parent part-il à ce passage ? Le premier passage à partir de l'heure choisie (fenêtre d'un passage, jamais deux fois). */
export function recapDue(prefs: unknown, localMinutes: number, tickMs = RECAP_TICK_MS): boolean {
  const s = recapSettings(prefs);
  if (!s.enabled) return false;
  const at = Number(s.time.slice(0, 2)) * 60 + Number(s.time.slice(3, 5));
  return localMinutes >= at && localMinutes < at + tickMs / 60_000;
}

export type ReminderTask = { id: string; child_id: string; title: string; date: string; time_kind: string; start_time: string | null; end_time: string | null };
export type DueReminder = { taskId: string; childId: string; title: string; kind: 'start' | 'deadline'; minutes: number; time: string };

/** Instant visé par un rappel : le début d'une plage, ou l'échéance ; `null` pour une tâche sans heure. */
export function reminderTarget(t: ReminderTask, timeZone: string): { kind: 'start' | 'deadline'; at: Date; time: string } | null {
  if (t.time_kind === 'range' && t.start_time) return { kind: 'start', at: zonedInstant(t.date, t.start_time, timeZone), time: t.start_time.slice(0, 5) };
  if (t.time_kind === 'deadline' && t.end_time) return { kind: 'deadline', at: zonedInstant(t.date, t.end_time, timeZone), time: t.end_time.slice(0, 5) };
  return null;
}

/** Minutes de rappel de l'enfant : absentes = valeurs par défaut de l'app (10 / 30), `null` = désactivé. */
export function reminderMinutes(prefs: unknown, kind: 'start' | 'deadline'): number | null {
  const key = kind === 'start' ? 'reminderBeforeStartMin' : 'reminderBeforeDeadlineMin';
  const fallback = kind === 'start' ? 10 : 30;
  const v = (prefs as Record<string, unknown> | null)?.[key];
  if (v === null || v === 0) return null; // désactivé (0 min = « à l'heure » : seulement le rappel local natif)
  return typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= MAX_REMINDER_MIN ? v : fallback;
}

/** Fenêtre d'une tâche : au-delà, aucun rappel possible (évite de charger les préférences d'une famille pour rien). */
export const REMINDER_HORIZON_MS = MAX_REMINDER_MIN * 60_000 + REMINDER_TICK_MS;

/**
 * Rappels à envoyer à CE passage pour un enfant : l'instant de rappel (début/échéance − minutes) tombe dans la fenêtre du passage et l'heure visée n'est pas
 * passée. « Dans N min » est le temps RÉEL restant (le passage peut avoir quelques minutes de retard). 0 minute = désactivé côté serveur.
 */
export function dueReminders(tasks: readonly ReminderTask[], prefs: unknown, now: Date, timeZone: string, tickMs = REMINDER_TICK_MS): DueReminder[] {
  const out: DueReminder[] = [];
  for (const t of tasks) {
    const target = reminderTarget(t, timeZone);
    if (!target) continue;
    const before = reminderMinutes(prefs, target.kind);
    if (before === null) continue;
    const remindAt = target.at.getTime() - before * 60_000;
    if (now.getTime() >= remindAt && now.getTime() < remindAt + tickMs && now.getTime() < target.at.getTime()) {
      out.push({ taskId: t.id, childId: t.child_id, title: t.title, kind: target.kind, minutes: Math.max(1, Math.round((target.at.getTime() - now.getTime()) / 60_000)), time: target.time });
    }
  }
  return out;
}

/** Rappel → texte dans la langue de l'appareil. */
export function reminderText(r: DueReminder, locale: Locale = 'vi'): Text {
  const c = catalogFor(locale);
  return { title: r.title, body: r.kind === 'start' ? c.reminderStart(r.minutes, r.time) : c.reminderDeadline(r.minutes, r.time) };
}

/**
 * Rappels de l'ENFANT sur ses navigateurs (Web Push) : les appareils natifs ont déjà leurs rappels locaux planifiés (pas de doublon), et jamais d'autre
 * destinataire que l'enfant concerné.
 */
export function buildReminderWebMessages(reminders: readonly DueReminder[], childMemberId: string, devices: readonly DeviceInfo[]): WebPushMessage[] {
  return reminders.flatMap((r) =>
    webDevicesOf(devices, childMemberId).map(
      (d): WebPushMessage => ({
        subscription: d.web_push_subscription as WebPushSubscription,
        payload: { ...reminderText(r, toLocale(d.locale)), data: { type: r.kind === 'start' ? 'reminder_start' : 'reminder_deadline', taskId: r.taskId }, url: '/', tag: `reminder-${r.taskId}-${r.kind}` },
      }),
    ),
  );
}
