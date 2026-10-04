import { normalizeLoginId, toChildAccountError, type ChildAccountErrorCode } from '@/domain/child-account';
import type { ChildRow } from '@/types/models';
import { createChild, type NewChild } from './family';
import { supabase } from './supabase';

/** Erreur renvoyée par les Edge Functions de comptes enfants (code stable, traduit par l'écran). */
export class ChildAccountError extends Error {
  constructor(readonly code: ChildAccountErrorCode) {
    super(code);
    this.name = 'ChildAccountError';
  }
}

async function call(name: 'create-child' | 'reset-child-password' | 'delete-child', body: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.functions.invoke(name, { body });
  if (!error) return;
  const response = (error as { context?: Response }).context;
  const parsed: unknown = await response?.json?.().catch(() => null);
  throw new ChildAccountError(toChildAccountError((parsed as { error?: string } | null)?.error));
}

/** Le PARENT crée le compte d'un enfant (Edge Function `create-child`, qui revérifie côté serveur que l'appelant est parent). */
export const createChildAccount = (childId: string, loginId: string, password: string) =>
  call('create-child', { childId, loginId: normalizeLoginId(loginId), password });

export const resetChildPassword = (childId: string, password: string) => call('reset-child-password', { childId, password });

/** Supprime le compte (connexion impossible, identifiant libéré) ; `deleteProfile` retire aussi le profil de l'enfant. */
export const deleteChildAccount = (childId: string, deleteProfile = false) => call('delete-child', { childId, deleteProfile });

export type ChildAccountInfo = { child_id: string; login_id: string };

/** Identifiants des enfants (RLS : lisibles par les parents de la famille uniquement). */
export async function fetchChildAccounts(): Promise<ChildAccountInfo[]> {
  const { data, error } = await supabase.from('child_accounts').select('child_id, login_id');
  if (error) throw error;
  return data;
}

/**
 * « Ajouter un enfant » : profil puis compte de connexion. Si le compte est refusé (identifiant déjà pris, mot de passe…),
 * le profil qu'on vient de créer est retiré : aucun enfant fantôme sans accès.
 */
export async function addChildWithAccount(familyId: string, profile: NewChild, loginId: string, password: string): Promise<ChildRow> {
  const child = await createChild(familyId, profile);
  try {
    await createChildAccount(child.id, loginId, password);
  } catch (error) {
    await deleteChildAccount(child.id, true).catch(() => undefined);
    throw error;
  }
  return child;
}
