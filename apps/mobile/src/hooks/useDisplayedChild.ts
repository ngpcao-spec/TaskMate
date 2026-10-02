import { isReadOnlyProfile, type Viewer } from '@/domain/permissions';
import { useSessionStore } from '@/store/session';
import { useMe } from './useMe';

/**
 * Profil affiché et droits associés. Enfant : son profil par défaut, celui du frère en lecture seule.
 * Parent : l'enfant sélectionné (premier par défaut).
 */
export function useDisplayedChild() {
  const me = useMe().data ?? null;
  const selected = useSessionStore((s) => s.displayedChildId);
  const setDisplayedChildId = useSessionStore((s) => s.setDisplayedChildId);
  if (!me) return null;

  const children = me.children;
  const defaultId = me.member.role === 'child' ? me.member.child_id : (children[0]?.id ?? null);
  const displayedId = selected && children.some((c) => c.id === selected) ? selected : defaultId;
  const child = children.find((c) => c.id === displayedId) ?? null;
  const viewer: Viewer = { role: me.member.role, memberId: me.member.id, childId: me.member.child_id };

  return {
    me,
    viewer,
    children,
    child,
    readOnly: isReadOnlyProfile(viewer, displayedId),
    select: setDisplayedChildId,
  };
}
