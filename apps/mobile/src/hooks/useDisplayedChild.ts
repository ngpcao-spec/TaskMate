import { resolveDisplayedChild } from '@/domain/displayed-child';
import type { Viewer } from '@/domain/permissions';
import { useSessionStore } from '@/store/session';
import { useMe } from './useMe';

const noop = (): void => undefined;

/**
 * Profil affiché. Enfant : toujours le sien (D-052 : il ne voit aucun autre enfant), sans état de sélection.
 * Parent : l'enfant sélectionné (premier par défaut) parmi tous ceux de la famille.
 */
export function useDisplayedChild() {
  const me = useMe().data ?? null;
  const selected = useSessionStore((s) => s.displayedChildId);
  const setDisplayedChildId = useSessionStore((s) => s.setDisplayedChildId);
  if (!me) return null;

  const isChild = me.member.role === 'child';
  const { children, child } = resolveDisplayedChild({ role: me.member.role, memberChildId: me.member.child_id, children: me.children, selectedId: selected });
  const viewer: Viewer = { role: me.member.role, memberId: me.member.id, childId: me.member.child_id };

  return { me, viewer, children, child, select: isChild ? noop : setDisplayedChildId };
}
