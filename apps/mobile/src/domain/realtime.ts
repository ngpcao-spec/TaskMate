/** Table publiée en Realtime → clés de requêtes TanStack à invalider (SPEC §6 : « invalidation des queries »). */
export type RealtimeTable = 'tasks' | 'goals' | 'rewards' | 'reward_requests' | 'point_transactions' | 'children' | 'quiz_sets' | 'quiz_attempts';

export const REALTIME_TABLES: readonly RealtimeTable[] = [
  'tasks',
  'goals',
  'rewards',
  'reward_requests',
  'point_transactions',
  'children',
  'quiz_sets',
  'quiz_attempts',
];

type Row = { child_id?: string | null; id?: string } | null | undefined;

export function invalidationsFor(table: RealtimeTable, row: Row): readonly (readonly string[])[] {
  const childId = row?.child_id ?? null;
  switch (table) {
    case 'tasks':
      // la file « Cần duyệt » et les points en attente suivent les tâches
      // + le centre de notifications (journal d'activité des parents) + l'énergie du panda (D-104 : un refus la retire)
      return childId ? [['tasks', childId], ['task', row?.id ?? ''], ['tasks', 'pending'], ['balance'], ['activity'], ['companion']] : [['tasks'], ['balance'], ['activity'], ['companion']];
    case 'goals':
      return [['goals', ...(childId ? [childId] : [])]];
    case 'rewards':
      return [['rewards']];
    // soldes et demandes : petites requêtes, partagées parent/enfants → invalidation par préfixe
    case 'reward_requests':
      return [['requests'], ['balance'], ['activity']];
    case 'point_transactions':
      return [['balance'], ['transactions']];
    case 'children':
      return [['me']];
    // révisions : jeux publiés/dépubliés, tentatives soumises/validées (le parent voit arriver une évaluation, l'enfant sa validation)
    case 'quiz_sets':
    case 'quiz_attempts':
      return [['quiz'], ['companion']]; // une validation donne de l'énergie au panda (D-104)
  }
}
