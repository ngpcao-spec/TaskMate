import type { MemberRole } from '@/types/models';

export type Viewer = { role: MemberRole; memberId: string; childId: string | null };
export type TaskOwnership = { child_id: string; completed_at?: string | null; validated_at?: string | null };

export type TaskPermissions = {
  /** Cocher / décocher (selon l'état courant). */
  canToggle: boolean;
  canEdit: boolean;
  canDelete: boolean;
  /** Valider / refuser une tâche cochée (parent). */
  canValidate: boolean;
};

/**
 * Droits côté UI (SPEC v4 §5.7) — la sécurité réelle reste la RLS/RPC.
 * Enfant : coche les siennes ; décoche seulement tant qu'elles ne sont pas validées ; ne crée/modifie/supprime rien ; frère = lecture seule.
 * Parent : tout, et seul à valider/refuser.
 */
export function taskPermissions(viewer: Viewer, task: TaskOwnership): TaskPermissions {
  if (viewer.role === 'parent') return { canToggle: true, canEdit: true, canDelete: true, canValidate: task.completed_at != null && task.validated_at == null };
  const own = viewer.childId === task.child_id;
  const locked = task.validated_at != null; // validée : plus décochable par l'enfant
  return { canToggle: own && !locked, canEdit: false, canDelete: false, canValidate: false };
}

/** Un enfant ne peut agir que sur son propre profil ; le profil du frère est en lecture seule. */
export function isReadOnlyProfile(viewer: Viewer, displayedChildId: string | null): boolean {
  return viewer.role === 'child' && displayedChildId !== viewer.childId;
}
