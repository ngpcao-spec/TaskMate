// Edge Function `send-push` — notifications push via Expo Push (SPEC §5.6).
// Déclenchée par un Database Webhook sur INSERT dans `activity_log` (voir HUMAN_TODO) et, pour le récap du soir
// des parents, par un appel planifié `{ "type": "evening_recap" }`. Protégée par `x-webhook-secret`.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import {
  buildMessages,
  buildRecapMessages,
  buildWebMessages,
  buildWebRecapMessages,
  deadEndpoints,
  chunk,
  countGroupedCompletions,
  tokensToRemove,
  type ActivityRecord,
  type DeviceInfo,
  type ExpoTicket,
  type MemberInfo,
  type PushMessage,
  type WebPushMessage,
} from './logic.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
import { jsonResponse as json, preflight } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) return json({ error: 'unauthorized' }, 401);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const body = (await req.json().catch(() => ({}))) as { type?: string; record?: ActivityRecord };

  const loadFamily = async (familyId: string) => {
    const { data: members } = await db.from('members').select('id, role, child_id, display_name').eq('family_id', familyId).is('revoked_at', null);
    const ids = (members ?? []).map((m) => m.id);
    const [{ data: prefs }, { data: devices }] = await Promise.all([
      db.from('notification_prefs').select('member_id, prefs').in('member_id', ids),
      db.from('devices').select('member_id, expo_push_token, web_push_subscription').in('member_id', ids).is('revoked_at', null),
    ]);
    const prefsOf = new Map((prefs ?? []).map((p) => [p.member_id, p.prefs]));
    return {
      members: (members ?? []).map((m) => ({ ...m, prefs: prefsOf.get(m.id) ?? null })) as MemberInfo[],
      devices: (devices ?? []) as DeviceInfo[],
    };
  };

  let messages: PushMessage[] = [];
  let webMessages: WebPushMessage[] = [];

  if (body.type === 'evening_recap') {
    const today = new Date().toISOString().slice(0, 10);
    const { data: families } = await db.from('families').select('id, timezone').is('deleted_at', null);
    for (const f of families ?? []) {
      const { members, devices } = await loadFamily(f.id);
      const { data: children } = await db.from('children').select('id, name').eq('family_id', f.id).is('deleted_at', null);
      const { data: tasks } = await db.from('tasks').select('child_id, completed_at').eq('family_id', f.id).eq('date', today).is('deleted_at', null);
      const { count: pendingTasks } = await db.from('tasks').select('id', { count: 'exact', head: true }).eq('family_id', f.id).not('completed_at', 'is', null).is('validated_at', null).is('deleted_at', null);
      const { count: pendingRequests } = await db.from('reward_requests').select('id', { count: 'exact', head: true }).eq('family_id', f.id).eq('status', 'pending');
      const summary = (children ?? []).map((c) => {
        const mine = (tasks ?? []).filter((t) => t.child_id === c.id);
        return { name: c.name, done: mine.filter((t) => t.completed_at).length, total: mine.length };
      });
      const parents = members.filter((m) => m.role === 'parent');
      const pending = { tasks: pendingTasks ?? 0, requests: pendingRequests ?? 0 };
      messages.push(...buildRecapMessages(parents, devices, summary, pending));
      webMessages.push(...buildWebRecapMessages(parents, devices, summary, pending));
    }
  } else if (body.record) {
    const activity = body.record;
    const { members, devices } = await loadFamily(activity.family_id);
    const { data: child } = activity.child_id ? await db.from('children').select('name').eq('id', activity.child_id).maybeSingle() : { data: null };
    // coches rapprochées d'un même enfant : une notification groupée (« Minh đã hoàn thành 3 việc »)
    let grouped = 1;
    if (activity.type === 'task_completed' && activity.child_id) {
      const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: recent } = await db.from('activity_log').select('created_at').eq('child_id', activity.child_id).eq('type', 'task_completed').gte('created_at', since);
      grouped = countGroupedCompletions(activity, recent ?? []);
    }
    messages = buildMessages(activity, members, devices, child?.name ?? '', grouped);
    webMessages = buildWebMessages(activity, members, devices, child?.name ?? '', grouped);
  }

  const sentTokens: string[] = [];
  const dead: string[] = [];
  for (const batch of chunk(messages, 100)) {
    const res = await fetch(EXPO_PUSH_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(batch) });
    const { data: tickets } = (await res.json()) as { data?: ExpoTicket[] };
    sentTokens.push(...batch.map((m) => m.to));
    dead.push(...tokensToRemove(batch, tickets ?? []));
  }
  // nettoyage des jetons invalides (SPEC §5.6)
  if (dead.length > 0) await db.from('devices').update({ expo_push_token: null }).in('expo_push_token', dead);


  // Web Push (VAPID) : optionnel — ignoré tant que les clés ne sont pas configurées (HUMAN_TODO)
  let webSent = 0;
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  if (webMessages.length > 0 && vapidPublic && vapidPrivate) {
    webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com', vapidPublic, vapidPrivate);
    const results = await Promise.all(
      webMessages.map(async (m) => {
        try {
          await webpush.sendNotification(m.subscription, JSON.stringify(m.payload), { TTL: 60 * 60 * 24 });
          webSent += 1;
          return { endpoint: m.subscription.endpoint };
        } catch (e) {
          return { endpoint: m.subscription.endpoint, statusCode: (e as { statusCode?: number }).statusCode };
        }
      }),
    );
    for (const endpoint of deadEndpoints(results)) {
      await db.from('devices').update({ revoked_at: new Date().toISOString(), web_push_subscription: null }).filter('web_push_subscription->>endpoint', 'eq', endpoint);
    }
  }

  return json({ sent: sentTokens.length, removed: dead.length, webSent });
});
