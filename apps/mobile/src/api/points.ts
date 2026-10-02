import type { BalanceSnapshot } from '@/domain/rewards';
import type { PointTransactionRow, RewardRequestRow, RewardRow } from '@/types/db';
import { newId } from './ids';
import { supabase } from './supabase';

export async function fetchBalance(childId: string): Promise<BalanceSnapshot> {
  const { data, error } = await supabase
    .from('child_balances')
    .select('balance, reserved, available')
    .eq('child_id', childId)
    .maybeSingle();
  if (error) throw error;
  return data ?? { balance: 0, reserved: 0, available: 0 };
}

export async function fetchRewards(): Promise<RewardRow[]> {
  const { data, error } = await supabase.from('rewards').select('*').is('deleted_at', null).order('sort_order').order('cost');
  if (error) throw error;
  return data;
}

/** Demandes des 30 derniers jours (RLS : l'enfant ne voit que les siennes, le parent toutes). */
export async function fetchRequests(childId: string | null): Promise<RewardRequestRow[]> {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  let query = supabase.from('reward_requests').select('*').gte('created_at', since).order('created_at', { ascending: false });
  if (childId) query = query.eq('child_id', childId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function fetchTransactions(childId: string, limit = 100): Promise<PointTransactionRow[]> {
  const { data, error } = await supabase
    .from('point_transactions')
    .select('*')
    .eq('child_id', childId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// ── RPC : toujours en ligne (SPEC §3.7). `requestId` / `txId` fixés par l'appelant → rejeu idempotent. ──
export async function requestReward(rewardId: string, requestId: string = newId()): Promise<void> {
  const { error } = await supabase.rpc('request_reward', { p_reward_id: rewardId, p_request_id: requestId });
  if (error) throw error;
}

export async function cancelRewardRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_reward_request', { p_request_id: requestId });
  if (error) throw error;
}

export async function approveRewardRequest(requestId: string, txId: string = newId()): Promise<void> {
  const { error } = await supabase.rpc('approve_reward_request', { p_request_id: requestId, p_tx_id: txId });
  if (error) throw error;
}

export async function rejectRewardRequest(requestId: string, note?: string): Promise<void> {
  const { error } = await supabase.rpc('reject_reward_request', { p_request_id: requestId, ...(note ? { p_note: note } : {}) });
  if (error) throw error;
}

export async function adjustPoints(childId: string, delta: number, note: string, txId: string = newId()): Promise<void> {
  const { error } = await supabase.rpc('adjust_points', { p_child_id: childId, p_delta: delta, p_note: note, p_tx_id: txId });
  if (error) throw error;
}

// ── CRUD récompenses (parent ; RLS) ──
export type RewardInput = { title: string; icon: string; cost: number; childId: string | null };

export async function saveReward(familyId: string, input: RewardInput, id?: string): Promise<void> {
  if (id) {
    const { error } = await supabase.from('rewards').update({ title: input.title, icon: input.icon, cost: input.cost, child_id: input.childId }).eq('id', id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from('rewards')
    .insert({ id: newId(), family_id: familyId, title: input.title, icon: input.icon, cost: input.cost, child_id: input.childId });
  if (error) throw error;
}

export async function deleteReward(id: string): Promise<void> {
  const { error } = await supabase.from('rewards').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}
