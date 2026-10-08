// Logique pure de l'Edge Function `send-push` (SPEC §5.6) — sans API Deno, donc testable avec Jest.

// ───────────────────────── Textes (D-063) ─────────────────────────

/** Langue des notifications (D-063) : vietnamien par défaut (SPEC §3.9), français, anglais. Vient de `devices.locale`, réglée par l'app (RPC `set_push_locale`). */
export type Locale = 'vi' | 'fr' | 'en';
export const DEFAULT_LOCALE: Locale = 'vi';

/** Toute valeur inconnue ou absente retombe sur le vietnamien (jamais d'erreur pour une notification). */
export const toLocale = (v: unknown): Locale => (v === 'fr' || v === 'en' || v === 'vi' ? v : DEFAULT_LOCALE);

type TextVars = { child: string; title: string; count: number; points: number; cost: number | string; delta: number; note: string };

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
  recapTitle: string;
  recapLine: (name: string, done: number, total: number) => string;
  recapWaiting: (count: number) => string;
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
    recapTitle: 'Tổng kết hôm nay',
    recapLine: (name, done, total) => `${name}: ${done}/${total} việc`,
    recapWaiting: (count) => `${count} mục chờ duyệt`,
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
    recapTitle: "Bilan d'aujourd'hui",
    recapLine: (name, done, total) => `${name} : ${done}/${total} tâches`,
    recapWaiting: (count) => `${count} à valider`,
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
    recapTitle: "Today's summary",
    recapLine: (name, done, total) => `${name}: ${done}/${total} tasks`,
    recapWaiting: (count) => `${count} waiting for approval`,
  },
};

const catalogFor = (locale: Locale): Catalog => CATALOGS[locale];

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
export type DeviceInfo = { member_id: string; expo_push_token: string | null; web_push_subscription?: WebPushSubscription | null; locale?: string | null };
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

const PARENT_TYPES = new Set(['task_completed', 'reward_requested', 'goal_achieved']);
const CHILD_TYPES = new Set(['task_validated', 'task_rejected', 'reward_approved', 'reward_rejected', 'reward_expired', 'points_adjusted', 'task_assigned']);

const activityPref = (prefs: unknown, key: 'taskDone' | 'rewardRequested' | 'goalAchieved'): boolean => {
  const activity = (prefs as { activity?: Record<string, unknown> } | null)?.activity;
  return activity?.[key] !== false; // activé par défaut
};

const PARENT_PREF: Record<string, 'taskDone' | 'rewardRequested' | 'goalAchieved'> = {
  task_completed: 'taskDone',
  reward_requested: 'rewardRequested',
  goal_achieved: 'goalAchieved',
};

/**
 * Destinataires d'une activité :
 *  - enfant → parent(s) : tâche faite, demande d'échange, objectif atteint (selon leurs préférences) ;
 *  - parent → enfant CONCERNÉ uniquement : décision sur une demande, points ajustés, nouvelle tâche.
 * Jamais de notification à un enfant à propos de l'activité de son frère (SPEC §5.6).
 */
export function recipientsFor(activity: ActivityRecord, members: readonly MemberInfo[]): MemberInfo[] {
  const notActor = (m: MemberInfo) => m.id !== activity.actor_member_id;
  if (PARENT_TYPES.has(activity.type)) {
    const key = PARENT_PREF[activity.type] as 'taskDone' | 'rewardRequested' | 'goalAchieved';
    return members.filter((m) => m.role === 'parent' && notActor(m) && activityPref(m.prefs, key));
  }
  if (CHILD_TYPES.has(activity.type)) {
    return members.filter((m) => m.role === 'child' && m.child_id !== null && m.child_id === activity.child_id && notActor(m));
  }
  return [];
}

type Text = { title: string; body: string };

/** Texte d'une activité dans la langue de l'appareil destinataire (vietnamien par défaut, D-063). */
export function textFor(activity: ActivityRecord, childName: string, groupedCount = 1, locale: Locale = 'vi'): Text | null {
  const p = (activity.payload ?? {}) as { title?: string; cost?: number; delta?: number; note?: string; points?: number };
  const v: TextVars = {
    child: childName,
    title: p.title ?? '',
    count: groupedCount,
    points: p.points ?? 0,
    cost: p.cost ?? '',
    delta: p.delta ?? 0,
    note: p.note ?? '',
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
    default:
      return null;
  }
}

/** Récap du soir : une ligne par enfant + éléments en attente, dans la langue donnée. `null` si rien à dire. */
export function recapText(
  summary: readonly { name: string; done: number; total: number }[],
  pending: { tasks: number; requests: number },
  locale: Locale = 'vi',
): Text | null {
  const c = catalogFor(locale);
  const lines = summary.filter((s) => s.total > 0).map((s) => c.recapLine(s.name, s.done, s.total));
  const waiting = pending.tasks + pending.requests;
  if (waiting > 0) lines.push(c.recapWaiting(waiting));
  if (lines.length === 0) return null;
  return { title: c.recapTitle, body: lines.join(' · ') };
}

/** Fenêtre de regroupement des coches (SPEC §5.6). */
export const GROUP_WINDOW_MS = 10 * 60 * 1000;

/** Nombre de coches d'un enfant dans la fenêtre de 10 min (l'activité courante comprise). */
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
  const p = (activity.payload ?? {}) as { request_id?: string; task_id?: string };
  const data: Record<string, unknown> = {
    type: activity.type,
    childId: activity.child_id,
    ...(p.request_id ? { requestId: p.request_id } : {}),
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
  pending: { tasks: number; requests: number } = { tasks: 0, requests: 0 },
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
export function urlForType(type: string): string {
  switch (type) {
    case 'task_completed':
    case 'reward_requested':
      return '/approvals';
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
          url: urlForType(activity.type),
          // les coches groupées d'un enfant se remplacent (même tag)
          ...(activity.type === 'task_completed' ? { tag: `tasks-${activity.child_id}` } : {}),
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
  pending: { tasks: number; requests: number } = { tasks: 0, requests: 0 },
): WebPushMessage[] {
  const waiting = pending.tasks + pending.requests;
  return parents.flatMap((parent) =>
    webDevicesOf(devices, parent.id).flatMap((d) => {
      const text = recapText(summary, pending, toLocale(d.locale));
      if (!text) return [];
      return [{ subscription: d.web_push_subscription as WebPushSubscription, payload: { ...text, data: { type: 'evening_recap' }, url: waiting > 0 ? '/approvals' : '/' } }];
    }),
  );
}

/** Abonnements à supprimer : le service push répond 404/410 (« Gone ») quand le navigateur s'est désabonné. */
export function deadEndpoints(results: readonly { endpoint: string; statusCode?: number }[]): string[] {
  return [...new Set(results.filter((r) => r.statusCode === 404 || r.statusCode === 410).map((r) => r.endpoint))];
}
