import type { MemberRole } from '@/types/db';

export type Viewer = { role: MemberRole; memberId: string; childId: string | null };
export type TaskOwnership = { child_id: string; created_by: string };

export type TaskPermissions = { canToggle: boolean; canEdit: boolean; canDelete: boolean };

/**
 * Droits côté UI (SPEC §5.7) — la sécurité réelle reste la RLS/RPC.
 * Enfant : coche les siennes, modifie/supprime celles qu'il a créées ; frère = lecture seule.
 * Parent : tout.
 */
export function taskPermissions(viewer: Viewer, task: TaskOwnership): TaskPermissions {
  if (viewer.role === 'parent') return { canToggle: true, canEdit: true, canDelete: true };
  const own = viewer.childId === task.child_id;
  const authored = own && task.created_by === viewer.memberId;
  return { canToggle: own, canEdit: authored, canDelete: authored };
}

/** Un enfant ne peut agir que sur son propre profil ; le profil du frère est en lecture seule. */
export function isReadOnlyProfile(viewer: Viewer, displayedChildId: string | null): boolean {
  return viewer.role === 'child' && displayedChildId !== viewer.childId;
}
