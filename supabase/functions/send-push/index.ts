// Edge Function `send-push` — notifications push via Expo Push et Web Push (SPEC §5.6).
// Trois usages :
//   1. Déclenchée par le déclencheur `activity_log_push` (INSERT dans `activity_log`, D-065) : protégée par `x-webhook-secret` ;
//   2. tâches planifiées `pg_cron` (D-099, même secret) : `{ "type": "evening_recap" }` toutes les 15 min (récap des parents dont l'heure choisie tombe dans ce
//      passage, jour et heure du fuseau de LA FAMILLE) et `{ "type": "task_reminders" }` toutes les 5 min (rappel « avant le début / l'échéance » à l'enfant,
//      sur ses navigateurs seulement : les appareils natifs ont leurs rappels locaux) ;
//   3. D-088, depuis l'app, par un membre CONNECTÉ (JWT) : `{ "type": "status" }` (état d'envoi du membre) et `{ "type": "test", "endpoint"? }`
//      (notification de test à SES appareils). Aucun secret n'est jamais renvoyé : seulement `vapidConfigured: true/false`.
// La réponse détaille pourquoi rien n'est parti : `skipped: { noRecipient, noDevice, prefOff, noVapid }` (compteurs, journalisés sans aucun secret).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import {
  buildMessages,
  buildRecapMessages,
  buildReminderWebMessages,
  buildTestMessages,
  buildWebMessages,
  buildWebRecapMessages,
  deadEndpoints,
  chunk,
  countGroupedCompletions,
  expoResultLabel,
  explainDelivery,
  dueReminders,
  localParts,
  recapDue,
  reminderTarget,
  REMINDER_HORIZON_MS,
  tokensToRemove,
  webResultLabel,
  type ActivityRecord,
  type DeviceInfo,
  type ExpoTicket,
  type MemberInfo,
  type PushMessage,
  type ReminderTask,
  type Skipped,
  type WebPushMessage,
} from './logic.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
import { jsonResponse as json, preflight } from '../_shared/cors.ts';

type Db = ReturnType<typeof createClient>;
type Body = { type?: string; record?: ActivityRecord; endpoint?: string };
/** Types d'activité dont les occurrences rapprochées d'un même enfant sont regroupées en UNE notification (10 min, §5.6). */
const GROUPED_TYPES = new Set(['task_completed', 'quiz_submitted']);

const vapidConfigured = (): boolean => Boolean(Deno.env.get('VAPID_PUBLIC_KEY') && Deno.env.get('VAPID_PRIVATE_KEY'));

/** Envoie les messages et mémorise le résultat par appareil (`devices.last_push_*`) ; nettoie les jetons / abonnements morts. */
async function deliver(db: Db, messages: PushMessage[], webMessages: WebPushMessage[]) {
  const now = new Date().toISOString();
  const expoResults = new Map<string, string[]>(); // résultat → jetons
  const sentTokens: string[] = [];
  const dead: string[] = [];
  const failures: { channel: 'expo' | 'web'; code: string }[] = [];
  for (const batch of chunk(messages, 100)) {
    let tickets: ExpoTicket[] = [];
    try {
      const res = await fetch(EXPO_PUSH_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(batch) });
      tickets = ((await res.json()) as { data?: ExpoTicket[] }).data ?? [];
    } catch {
      // Expo injoignable : les appareils de ce lot gardent « error:network »
    }
    sentTokens.push(...batch.map((m) => m.to));
    dead.push(...tokensToRemove(batch, tickets));
    batch.forEach((m, i) => {
      const label = tickets.length === 0 ? 'error:network' : expoResultLabel(tickets[i]);
      expoResults.set(label, [...(expoResults.get(label) ?? []), m.to]);
      if (label !== 'sent') failures.push({ channel: 'expo', code: label });
    });
  }
  for (const [label, tokens] of expoResults) await db.from('devices').update({ last_push_at: now, last_push_result: label }).in('expo_push_token', tokens);
  // nettoyage des jetons invalides (SPEC §5.6)
  if (dead.length > 0) await db.from('devices').update({ expo_push_token: null }).in('expo_push_token', dead);

  // Web Push (VAPID) : ignoré tant que les clés ne sont pas configurées (HUMAN_TODO) — compté dans `skipped.noVapid`
  let webSent = 0;
  let noVapid = 0;
  if (webMessages.length > 0) {
    if (!vapidConfigured()) {
      noVapid = webMessages.length;
    } else {
      webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com', Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);
      const results = await Promise.all(
        webMessages.map(async (m) => {
          try {
            await webpush.sendNotification(m.subscription, JSON.stringify(m.payload), { TTL: 60 * 60 * 24 });
            webSent += 1;
            return { endpoint: m.subscription.endpoint };
          } catch (e) {
            const statusCode = (e as { statusCode?: number }).statusCode;
            failures.push({ channel: 'web', code: webResultLabel(statusCode ?? 0) });
            return { endpoint: m.subscription.endpoint, statusCode: statusCode ?? 0 };
          }
        }),
      );
      for (const r of results) {
        await db.from('devices').update({ last_push_at: now, last_push_result: r.statusCode === undefined ? 'sent' : webResultLabel(r.statusCode) }).filter('web_push_subscription->>endpoint', 'eq', r.endpoint).is('revoked_at', null);
      }
      for (const endpoint of deadEndpoints(results)) {
        await db.from('devices').update({ revoked_at: new Date().toISOString(), web_push_subscription: null }).filter('web_push_subscription->>endpoint', 'eq', endpoint);
      }
    }
  }
  return { sent: sentTokens.length, removed: dead.length, webSent, noVapid, failures };
}

/** Appel d'un membre connecté (D-088) : `status` (lecture seule) et `test` (notification de test à SES appareils). */
async function handleMember(req: Request, db: Db, body: Body): Promise<Response> {
  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'not_authenticated' }, 401);
  const asCaller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: user, error: userError } = await asCaller.auth.getUser();
  if (userError || !user.user) return json({ error: 'not_authenticated' }, 401);
  const { data: me } = await db.from('members').select('id').eq('user_id', user.user.id).is('revoked_at', null).is('deleted_at', null).maybeSingle();
  if (!me) return json({ error: 'no_member' }, 403);
  const { data: rows } = await db
    .from('devices')
    .select('id, member_id, expo_push_token, web_push_subscription, locale, last_push_at, last_push_result')
    .eq('member_id', me.id)
    .is('revoked_at', null);
  const devices = (rows ?? []) as (DeviceInfo & { last_push_at: string | null; last_push_result: string | null })[];
  const active = devices.filter((d) => d.expo_push_token || d.web_push_subscription?.endpoint);
  const configured = vapidConfigured();
  if (body.type === 'status') {
    const last = [...active].filter((d) => d.last_push_at).sort((a, b) => String(b.last_push_at).localeCompare(String(a.last_push_at)))[0];
    return json({ mode: 'status', vapidConfigured: configured, activeDevices: active.length, lastPushAt: last?.last_push_at ?? null, lastPushResult: last?.last_push_result ?? null });
  }
  const { expo, web } = buildTestMessages(active, me.id, body.endpoint ?? null);
  const result = await deliver(db, expo, web);
  console.log('send-push test', JSON.stringify({ devices: expo.length + web.length, sent: result.sent, webSent: result.webSent, noVapid: result.noVapid, failed: result.failures.length }));
  return json({ mode: 'test', vapidConfigured: configured, devices: expo.length + web.length, sent: result.sent, webSent: result.webSent, noVapid: result.noVapid, failures: result.failures });
}

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const body = (await req.json().catch(() => ({}))) as Body;
  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    // pas de secret valide : seul un membre connecté peut demander son état ou un test (jamais un envoi d'activité)
    if (req.method === 'POST' && (body.type === 'status' || body.type === 'test')) return handleMember(req, db, body);
    return json({ error: 'unauthorized' }, 401);
  }

  const loadFamily = async (familyId: string) => {
    const { data: members } = await db.from('members').select('id, role, child_id, display_name').eq('family_id', familyId).is('revoked_at', null);
    const ids = (members ?? []).map((m) => m.id);
    const [{ data: prefs }, { data: devices }] = await Promise.all([
      db.from('notification_prefs').select('member_id, prefs').in('member_id', ids),
      db.from('devices').select('id, member_id, expo_push_token, web_push_subscription, locale').in('member_id', ids).is('revoked_at', null),
    ]);
    const prefsOf = new Map((prefs ?? []).map((p) => [p.member_id, p.prefs]));
    return {
      members: (members ?? []).map((m) => ({ ...m, prefs: prefsOf.get(m.id) ?? null })) as MemberInfo[],
      devices: (devices ?? []) as DeviceInfo[],
    };
  };

  let messages: PushMessage[] = [];
  let webMessages: WebPushMessage[] = [];
  let skipped: Omit<Skipped, 'noVapid'> = { noRecipient: 0, noDevice: 0, prefOff: 0 };

  if (body.type === 'evening_recap') {
    const now = new Date();
    const { data: families } = await db.from('families').select('id, timezone').is('deleted_at', null);
    for (const f of families ?? []) {
      let local: { date: string; minutes: number };
      try {
        local = localParts(now, f.timezone); // jour et heure LOCAUX de la famille, jamais l'UTC
      } catch {
        continue; // fuseau illisible : cette famille est ignorée, pas les autres
      }
      const { members, devices } = await loadFamily(f.id);
      const parents = members.filter((m) => m.role === 'parent' && recapDue(m.prefs, local.minutes));
      if (parents.length === 0) continue;
      const { data: children } = await db.from('children').select('id, name').eq('family_id', f.id).is('deleted_at', null);
      const { data: tasks } = await db.from('tasks').select('child_id, completed_at').eq('family_id', f.id).eq('date', local.date).is('deleted_at', null);
      const { count: pendingTasks } = await db.from('tasks').select('id', { count: 'exact', head: true }).eq('family_id', f.id).not('completed_at', 'is', null).is('validated_at', null).is('deleted_at', null);
      const { count: pendingRequests } = await db.from('reward_requests').select('id', { count: 'exact', head: true }).eq('family_id', f.id).eq('status', 'pending');
      // quiz « Ôn tập » envoyés, pas encore validés (D-088)
      const { count: pendingQuizzes } = await db.from('quiz_attempts').select('id', { count: 'exact', head: true }).eq('family_id', f.id).eq('status', 'submitted');
      const summary = (children ?? []).map((c) => {
        const mine = (tasks ?? []).filter((t) => t.child_id === c.id);
        return { name: c.name, done: mine.filter((t) => t.completed_at).length, total: mine.length };
      });
      const pending = { tasks: pendingTasks ?? 0, requests: pendingRequests ?? 0, quizzes: pendingQuizzes ?? 0 };
      messages.push(...buildRecapMessages(parents, devices, summary, pending));
      webMessages.push(...buildWebRecapMessages(parents, devices, summary, pending));
    }
  } else if (body.type === 'task_reminders') {
    const now = new Date();
    const day = (offset: number) => new Date(now.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
    const { data: families } = await db.from('families').select('id, timezone').is('deleted_at', null);
    const zoneOf = new Map((families ?? []).map((f) => [f.id as string, f.timezone as string]));
    // une seule lecture : tâches à heure, non cochées, autour d'aujourd'hui (le jour local d'une famille est à ±1 jour du jour UTC)
    const { data: rows } = await db
      .from('tasks')
      .select('id, family_id, child_id, title, date, time_kind, start_time, end_time')
      .neq('time_kind', 'anytime')
      .is('completed_at', null)
      .is('deleted_at', null)
      .gte('date', day(-1))
      .lte('date', day(2));
    const byFamily = new Map<string, ReminderTask[]>();
    for (const t of (rows ?? []) as (ReminderTask & { family_id: string })[]) {
      const zone = zoneOf.get(t.family_id);
      if (!zone) continue;
      try {
        const target = reminderTarget(t, zone);
        const ahead = target ? target.at.getTime() - now.getTime() : -1;
        if (ahead <= 0 || ahead > REMINDER_HORIZON_MS) continue; // heure visée passée ou trop lointaine : aucun rappel possible
      } catch {
        continue;
      }
      byFamily.set(t.family_id, [...(byFamily.get(t.family_id) ?? []), t]);
    }
    for (const [familyId, tasks] of byFamily) {
      const zone = zoneOf.get(familyId) as string;
      const { members, devices } = await loadFamily(familyId);
      for (const child of members.filter((m) => m.role === 'child' && m.child_id)) {
        const due = dueReminders(tasks.filter((t) => t.child_id === child.child_id), child.prefs, now, zone);
        webMessages.push(...buildReminderWebMessages(due, child.id, devices));
      }
    }
  } else if (body.record) {
    const activity = body.record;
    const { members, devices } = await loadFamily(activity.family_id);
    const { data: child } = activity.child_id ? await db.from('children').select('name').eq('id', activity.child_id).maybeSingle() : { data: null };
    // occurrences rapprochées d'un même enfant : une notification groupée (« Minh đã hoàn thành 3 việc », « … 3 quiz — à valider »)
    let grouped = 1;
    if (GROUPED_TYPES.has(activity.type) && activity.child_id) {
      const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: recent } = await db.from('activity_log').select('created_at').eq('child_id', activity.child_id).eq('type', activity.type).gte('created_at', since);
      grouped = countGroupedCompletions(activity, recent ?? []);
    }
    messages = buildMessages(activity, members, devices, child?.name ?? '', grouped);
    webMessages = buildWebMessages(activity, members, devices, child?.name ?? '', grouped);
    skipped = explainDelivery(activity, members, devices).skipped;
  }

  const result = await deliver(db, messages, webMessages);
  const full: Skipped = { ...skipped, noVapid: result.noVapid };
  // diagnostic : seulement des compteurs, jamais un jeton, une clé ou un secret
  console.log('send-push', JSON.stringify({ type: body.type ?? body.record?.type ?? 'unknown', sent: result.sent, webSent: result.webSent, removed: result.removed, skipped: full }));
  return json({ sent: result.sent, removed: result.removed, webSent: result.webSent, skipped: full });
});
