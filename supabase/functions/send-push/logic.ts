// Logique pure de l'Edge Function `send-push` (SPEC §5.6) — sans API Deno, donc testable avec Jest.

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
export type DeviceInfo = { member_id: string; expo_push_token: string | null };
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

/** Textes en vietnamien (langue par défaut de l'app). */
export function textFor(activity: ActivityRecord, childName: string, groupedCount = 1): Text | null {
  const p = (activity.payload ?? {}) as { title?: string; cost?: number; delta?: number; note?: string; points?: number };
  const title = p.title ?? '';
  switch (activity.type) {
    case 'task_completed':
      // tâche cochée À VALIDER ; plusieurs coches en moins de 10 min → une seule notification groupée (§5.6)
      return groupedCount > 1
        ? { title: 'TaskMate', body: `${childName} đã hoàn thành ${groupedCount} việc — chờ duyệt` }
        : { title: 'TaskMate', body: `${childName} đã hoàn thành: ${title} — chờ duyệt` };
    case 'task_validated':
      return { title: 'TaskMate', body: `Đã được duyệt 🎉 ${title} (+${p.points ?? 0} điểm)` };
    case 'task_rejected':
      return { title: 'TaskMate', body: `Việc bị từ chối: ${title}${p.note ? ` — ${p.note}` : ''}` };
    case 'reward_requested':
      return { title: 'TaskMate', body: `${childName} muốn đổi: ${title} (${p.cost ?? ''} điểm)` };
    case 'goal_achieved':
      return { title: 'TaskMate', body: `${childName} đã đạt mục tiêu: ${title}` };
    case 'reward_approved':
      return { title: 'TaskMate', body: `Đã được duyệt 🎉 ${title}` };
    case 'reward_rejected':
      return { title: 'TaskMate', body: `Yêu cầu bị từ chối: ${title}${p.note ? ` — ${p.note}` : ''}` };
    case 'reward_expired':
      return { title: 'TaskMate', body: `Yêu cầu đã hết hạn: ${title}` };
    case 'points_adjusted':
      return { title: 'TaskMate', body: `Điểm của bạn được điều chỉnh ${(p.delta ?? 0) > 0 ? '+' : ''}${p.delta ?? 0}` };
    case 'task_assigned':
      return { title: 'TaskMate', body: `Việc mới: ${title}` };
    default:
      return null;
  }
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
  const text = textFor(activity, childName, groupedCount);
  if (!text) return [];
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
        ...text,
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

/** Récap du soir pour les parents : une ligne par enfant « Minh: 3/5 việc » + éléments en attente de décision (tâches, échanges). */
export function buildRecapMessages(
  parents: readonly MemberInfo[],
  devices: readonly DeviceInfo[],
  summary: readonly { name: string; done: number; total: number }[],
  pending: { tasks: number; requests: number } = { tasks: 0, requests: 0 },
): PushMessage[] {
  const lines = summary.filter((s) => s.total > 0).map((s) => `${s.name}: ${s.done}/${s.total} việc`);
  const waiting = pending.tasks + pending.requests;
  if (waiting > 0) lines.push(`${waiting} mục chờ duyệt`);
  if (lines.length === 0) return [];
  const out: PushMessage[] = [];
  for (const parent of parents) {
    for (const d of devices) {
      if (d.member_id === parent.id && d.expo_push_token) {
        out.push({ to: d.expo_push_token, title: 'Tổng kết hôm nay', body: lines.join(' · '), data: { type: 'evening_recap' }, sound: 'default', channelId: 'default' });
      }
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
