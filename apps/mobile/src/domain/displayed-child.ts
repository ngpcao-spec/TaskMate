import type { MemberRole } from '@/types/models';

export type DisplayInput<C extends { id: string }> = {
  role: MemberRole;
  /** Profil enfant du membre connecté (null pour un parent). */
  memberChildId: string | null;
  children: C[];
  /** Enfant sélectionné par un parent (état local). Ignoré pour un enfant. */
  selectedId: string | null;
};

/**
 * Enfant affiché. D-052 : un ENFANT ne voit que lui-même — toujours son propre profil, sans état de sélection et sans jamais
 * lire un autre enfant du cache (la RLS refuse déjà ces lignes ; ici on l'applique aussi à l'affichage). Parent : l'enfant
 * sélectionné, le premier par défaut, parmi tous les enfants de la famille.
 */
export function resolveDisplayedChild<C extends { id: string }>(input: DisplayInput<C>): { children: C[]; child: C | null; displayedId: string | null } {
  if (input.role === 'child') {
    const own = input.children.filter((c) => c.id === input.memberChildId);
    return { children: own, child: own[0] ?? null, displayedId: own[0]?.id ?? null };
  }
  const fallback = input.children[0]?.id ?? null;
  const displayedId = input.selectedId && input.children.some((c) => c.id === input.selectedId) ? input.selectedId : fallback;
  return { children: input.children, child: input.children.find((c) => c.id === displayedId) ?? null, displayedId };
}
