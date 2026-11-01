import { useMutation, useMutationState, useQuery } from '@tanstack/react-query';
import type { CollectResult } from '@/api/adventure';
import { fetchAdventureState } from '@/api/adventure';
import { adventureKeys } from '@/api/keys';
import { newId } from '@/api/ids';
import type { AdventureState } from '@/domain/adventure';
import { mutationKeys, type CollectAdventureVars, type StartAdventureVars } from '@/sync/mutations';

/** État des aventures d'un enfant (jauge, aventure en cours, carnet). `enabled` faux : aucune requête. */
export function useAdventure(childId: string | null | undefined, enabled = true) {
  return useQuery<AdventureState>({
    queryKey: adventureKeys.state(childId ?? 'none'),
    queryFn: () => fetchAdventureState(childId as string),
    enabled: enabled && !!childId,
    staleTime: 30_000,
  });
}

// Écritures : file `writes` (sync/mutations.ts), rejouées hors ligne avec le même id.
export const useStartAdventure = () => useMutation<void, unknown, StartAdventureVars>({ mutationKey: mutationKeys.startAdventure });
export const useCollectAdventure = () => useMutation<CollectResult, unknown, CollectAdventureVars>({ mutationKey: mutationKeys.collectAdventure });
/** Variables d'un départ : l'id de l'aventure est tiré ICI, une seule fois (tout rejeu reste idempotent). */
export const startVars = (childId: string, destination: string): StartAdventureVars => ({ childId, adventureId: newId(), destination });

/** Une écriture d'aventure de cet enfant attend (hors ligne, ou en cours d'envoi) : l'écran affiche « en attente ». */
export function useAdventurePending(childId: string | null | undefined): boolean {
  const pending = useMutationState({
    filters: { status: 'pending', predicate: (m) => ['startAdventure', 'collectAdventure'].includes(String(m.options.mutationKey?.[0])) },
    select: (m) => (m.state.variables as { childId?: string } | undefined)?.childId ?? null,
  });
  return !!childId && pending.includes(childId);
}
