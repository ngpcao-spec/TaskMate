import { DEFAULT_PREFS, normalizePrefs, type NotificationPrefs } from '@/domain/notification-prefs';
import type { PushSubscriptionJson } from '@/domain/web-push';
import type { ActivityLogRow, RewardRequestRow } from '@/types/models';
import { loadLanguage } from '@/i18n/language';
import type { Language } from '@/i18n';
import { supabase } from './supabase';

export async function fetchPrefs(memberId: string): Promise<NotificationPrefs> {
  const { data, error } = await supabase.from('notification_prefs').select('prefs').eq('member_id', memberId).maybeSingle();
  if (error) throw error;
  return data ? normalizePrefs(data.prefs) : DEFAULT_PREFS;
}

/**
 * Enregistre les préférences du membre. PAS d'`upsert` : PostgREST réécrirait aussi `member_id` (`ON CONFLICT … SET member_id = …`), colonne dont
 * l'UPDATE est refusé aux clients (RLS/droits de colonne, D-066) → 403 à chaque enregistrement. On met à jour la ligne ; si elle n'existe pas encore,
 * on la crée ; si deux enregistrements se croisent (clé déjà prise, 23505), on remet à jour.
 */
export async function savePrefs(memberId: string, prefs: NotificationPrefs): Promise<void> {
  const update = async (): Promise<number> => {
    const { data, error } = await supabase.from('notification_prefs').update({ prefs }).eq('member_id', memberId).select('member_id');
    if (error) throw error;
    return data.length;
  };
  if ((await update()) > 0) return;
  const { error } = await supabase.from('notification_prefs').insert({ member_id: memberId, prefs });
  if (!error) return;
  if (error.code === '23505' && (await update()) > 0) return;
  throw error;
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

/** Langue des notifications push de mes appareils (D-063) : celle choisie dans l'app. RPC, aucune écriture directe sur `devices`. */
export async function setPushLocale(locale: Language = loadLanguage()): Promise<void> {
  const { error } = await supabase.rpc('set_push_locale', { p_locale: locale });
  if (error) throw error;
}

/** Même chose sans jamais échouer : la langue d'une notification ne doit pas casser l'enregistrement ni un changement de langue. */
export async function syncPushLocale(): Promise<void> {
  try {
    await setPushLocale();
  } catch {
    // hors ligne, déconnecté ou appareil non enregistré : la langue sera renvoyée à la prochaine inscription
  }
}

export async function registerDevice(token: string, platform: 'ios' | 'android'): Promise<void> {
  const { error } = await supabase.rpc('register_device', { p_token: token, p_platform: platform });
  if (error) throw error;
  await syncPushLocale();
}

/** Web Push : enregistre l'abonnement du navigateur (RPC, aucune écriture directe sur `devices`). */
export async function registerWebPush(subscription: PushSubscriptionJson): Promise<void> {
  const { error } = await supabase.rpc('register_web_push', { p_subscription: subscription });
  if (error) throw error;
  await syncPushLocale();
}

export async function unregisterWebPush(endpoint: string): Promise<void> {
  const { error } = await supabase.rpc('unregister_web_push', { p_endpoint: endpoint });
  if (error) throw error;
}
