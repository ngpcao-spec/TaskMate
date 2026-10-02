import { DEFAULT_PREFS, normalizePrefs, type NotificationPrefs } from '@/domain/notification-prefs';
import type { PushSubscriptionJson } from '@/domain/web-push';
import type { ActivityLogRow, RewardRequestRow } from '@/types/models';
import { supabase } from './supabase';

export async function fetchPrefs(memberId: string): Promise<NotificationPrefs> {
  const { data, error } = await supabase.from('notification_prefs').select('prefs').eq('member_id', memberId).maybeSingle();
  if (error) throw error;
  return data ? normalizePrefs(data.prefs) : DEFAULT_PREFS;
}

export async function savePrefs(memberId: string, prefs: NotificationPrefs): Promise<void> {
  const { error } = await supabase.from('notification_prefs').upsert({ member_id: memberId, prefs }, { onConflict: 'member_id' });
  if (error) throw error;
}

/** Centre de notifications parent : activité récente de la famille (RLS : parents uniquement). */
export async function fetchActivity(limit = 50): Promise<ActivityLogRow[]> {
  const { data, error } = await supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data;
}

/** Centre de notifications enfant : décisions récentes sur ses demandes d'échange. */
export async function fetchDecidedRequests(limit = 20): Promise<RewardRequestRow[]> {
  const { data, error } = await supabase
    .from('reward_requests')
    .select('*')
    .neq('status', 'pending')
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function registerDevice(token: string, platform: 'ios' | 'android'): Promise<void> {
  const { error } = await supabase.rpc('register_device', { p_token: token, p_platform: platform });
  if (error) throw error;
}

/** Web Push : enregistre l'abonnement du navigateur (RPC, aucune écriture directe sur `devices`). */
export async function registerWebPush(subscription: PushSubscriptionJson): Promise<void> {
  const { error } = await supabase.rpc('register_web_push', { p_subscription: subscription });
  if (error) throw error;
}

export async function unregisterWebPush(endpoint: string): Promise<void> {
  const { error } = await supabase.rpc('unregister_web_push', { p_endpoint: endpoint });
  if (error) throw error;
}
