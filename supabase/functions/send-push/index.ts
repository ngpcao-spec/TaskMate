// Edge Function `send-push` — notifications push via Expo Push (SPEC §5.6).
// Déclenchée par un Database Webhook sur INSERT dans `activity_log` (voir HUMAN_TODO) et, pour le récap du soir
// des parents, par un appel planifié `{ "type": "evening_recap" }`. Protégée par `x-webhook-secret`.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  buildMessages,
  buildRecapMessages,
  chunk,
  tokensToRemove,
  type ActivityRecord,
  type DeviceInfo,
  type ExpoTicket,
  type MemberInfo,
  type PushMessage,
} from './logic.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) return json({ error: 'unauthorized' }, 401);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const body = (await req.json().catch(() => ({}))) as { type?: string; record?: ActivityRecord };

  const loadFamily = async (familyId: string) => {
    const { data: members } = await db.from('members').select('id, role, child_id, display_name').eq('family_id', familyId).is('revoked_at', null);
    const ids = (members ?? []).map((m) => m.id);
    const [{ data: prefs }, { data: devices }] = await Promise.all([
      db.from('notification_prefs').select('member_id, prefs').in('member_id', ids),
      db.from('devices').select('member_id, expo_push_token').in('member_id', ids).is('revoked_at', null),
    ]);
    const prefsOf = new Map((prefs ?? []).map((p) => [p.member_id, p.prefs]));
    return {
      members: (members ?? []).map((m) => ({ ...m, prefs: prefsOf.get(m.id) ?? null })) as MemberInfo[],
      devices: (devices ?? []) as DeviceInfo[],
    };
  };

  let messages: PushMessage[] = [];

  if (body.type === 'evening_recap') {
    const today = new Date().toISOString().slice(0, 10);
    const { data: families } = await db.from('families').select('id, timezone').is('deleted_at', null);
    for (const f of families ?? []) {
      const { members, devices } = await loadFamily(f.id);
      const { data: children } = await db.from('children').select('id, name').eq('family_id', f.id).is('deleted_at', null);
      const { data: tasks } = await db.from('tasks').select('child_id, completed_at').eq('family_id', f.id).eq('date', today).is('deleted_at', null);
      const summary = (children ?? []).map((c) => {
        const mine = (tasks ?? []).filter((t) => t.child_id === c.id);
        return { name: c.name, done: mine.filter((t) => t.completed_at).length, total: mine.length };
      });
      messages.push(...buildRecapMessages(members.filter((m) => m.role === 'parent'), devices, summary));
    }
  } else if (body.record) {
    const activity = body.record;
    const { members, devices } = await loadFamily(activity.family_id);
    const { data: child } = activity.child_id ? await db.from('children').select('name').eq('id', activity.child_id).maybeSingle() : { data: null };
    messages = buildMessages(activity, members, devices, child?.name ?? '');
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

  return json({ sent: sentTokens.length, removed: dead.length });
});
