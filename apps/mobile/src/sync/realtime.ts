import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabase';
import { invalidationsFor, REALTIME_TABLES, type RealtimeTable } from '@/domain/realtime';

type Payload = { new: Record<string, unknown>; old: Record<string, unknown> };
type Shared = { count: number; release: () => void };

/**
 * Abonnements PARTAGÉS : plusieurs écrans peuvent demander le canal de la même famille en même temps (ex. juste après la connexion, l'arbre V1
 * puis l'arbre V2 montent chacun `useShellEffects`). `supabase.channel(topic)` RENVOIE le canal existant s'il a le même nom, et refuse ensuite
 * d'y ajouter des écoutes une fois abonné (« cannot add `postgres_changes` callbacks … after `subscribe()` », écran d'erreur). D'où :
 * - un seul canal par (client de requêtes, famille), compté ; le dernier désabonnement le retire ;
 * - un nom NEUF par canal créé (`family:<id>:<n>`) : un canal en cours de retrait (retrait asynchrone) n'est jamais réutilisé.
 */
const shared = new WeakMap<QueryClient, Map<string, Shared>>();
let sequence = 0;

function openChannel(queryClient: QueryClient, familyId: string): () => void {
  sequence += 1;
  const channel = supabase.channel(`family:${familyId}:${sequence}`);
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

/**
 * Un canal par famille : toute écriture (de l'enfant ou du parent) invalide les requêtes concernées,
 * ce qui rafraîchit l'écran en quelques secondes (SPEC §8). La RLS filtre ce que chacun reçoit.
 * Retourne la fonction de désabonnement (sans effet si appelée deux fois).
 */
export function subscribeFamilyRealtime(queryClient: QueryClient, familyId: string): () => void {
  let byFamily = shared.get(queryClient);
  if (!byFamily) {
    byFamily = new Map();
    shared.set(queryClient, byFamily);
  }
  const families = byFamily;
  let entry = families.get(familyId);
  if (entry) entry.count += 1;
  else {
    entry = { count: 1, release: openChannel(queryClient, familyId) };
    families.set(familyId, entry);
  }
  const current = entry;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    current.count -= 1;
    if (current.count > 0) return;
    if (families.get(familyId) === current) families.delete(familyId);
    current.release();
  };
}
