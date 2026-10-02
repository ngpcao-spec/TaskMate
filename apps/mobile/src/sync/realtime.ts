import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabase';
import { invalidationsFor, REALTIME_TABLES, type RealtimeTable } from '@/domain/realtime';

type Payload = { new: Record<string, unknown>; old: Record<string, unknown> };

/**
 * Un canal par famille : toute écriture (de l'enfant ou du parent) invalide les requêtes concernées,
 * ce qui rafraîchit l'écran en quelques secondes (SPEC §8). La RLS filtre ce que chacun reçoit.
 * Retourne la fonction de désabonnement.
 */
export function subscribeFamilyRealtime(queryClient: QueryClient, familyId: string): () => void {
  const channel = supabase.channel(`family:${familyId}`);
  for (const table of REALTIME_TABLES) {
    channel.on(
      'postgres_changes' as never,
      { event: '*', schema: 'public', table, filter: `family_id=eq.${familyId}` } as never,
      ((payload: Payload) => {
        const row = (Object.keys(payload.new ?? {}).length > 0 ? payload.new : payload.old) as {
          id?: string;
          child_id?: string | null;
        };
        for (const queryKey of invalidationsFor(table as RealtimeTable, row)) {
          void queryClient.invalidateQueries({ queryKey: [...queryKey] });
        }
      }) as never,
    );
  }
  let wasSubscribed = false;
  channel.subscribe((status: string) => {
    if (status !== 'SUBSCRIBED') return;
    // (re)connexion : rattrape ce qui a été manqué et relance la file d'écritures
    if (wasSubscribed) void queryClient.invalidateQueries();
    wasSubscribed = true;
    void queryClient.resumePausedMutations();
  });
  return () => {
    void supabase.removeChannel(channel);
  };
}
