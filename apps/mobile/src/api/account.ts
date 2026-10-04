import type { DeviceRow, MemberRow } from '@/types/models';
import { supabase } from './supabase';

/** Supprime la famille et toutes ses données puis les comptes auth (Edge Function `delete-account`, parent uniquement). */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
}

export type DeviceWithMember = DeviceRow & { member: Pick<MemberRow, 'id' | 'display_name' | 'role' | 'child_id' | 'revoked_at'> | null };

/** Appareils liés de la famille (RLS : le parent voit ceux de tous les membres). */
export async function fetchDevices(): Promise<DeviceWithMember[]> {
  const [devices, members] = await Promise.all([
    supabase.from('devices').select('*').is('revoked_at', null).order('last_seen_at', { ascending: false }),
    supabase.from('members').select('id, display_name, role, child_id, revoked_at'),
  ]);
  if (devices.error) throw devices.error;
  if (members.error) throw members.error;
  const byId = new Map(members.data.map((m) => [m.id, m]));
  return devices.data.map((d) => ({ ...d, member: byId.get(d.member_id) ?? null }));
}

export async function revokeDevice(deviceId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_device', { p_device_id: deviceId });
  if (error) throw error;
}

export async function updateChild(id: string, patch: { name?: string; birth_date?: string; color?: string; label?: string | null }): Promise<void> {
  const { error } = await supabase.from('children').update(patch).eq('id', id);
  if (error) throw error;
}

export async function updateFamilyTimezone(familyId: string, timezone: string): Promise<void> {
  const { error } = await supabase.from('families').update({ timezone }).eq('id', familyId);
  if (error) throw error;
}
