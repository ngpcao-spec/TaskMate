/** Table publiée en Realtime → clés de requêtes TanStack à invalider (SPEC §6 : « invalidation des queries »). */
export type RealtimeTable = 'tasks' | 'goals' | 'rewards' | 'reward_requests' | 'point_transactions' | 'children';

export const REALTIME_TABLES: readonly RealtimeTable[] = [
  'tasks',
  'goals',
  'rewards',
  'reward_requests',
  'point_transactions',
  'children',
];

type Row = { child_id?: string | null; id?: string } | null | undefined;

export function invalidationsFor(table: RealtimeTable, row: Row): readonly (readonly string[])[] {
  const childId = row?.child_id ?? null;
  switch (table) {
    case 'tasks':
      // la file « Cần duyệt » et les points en attente suivent les tâches
      return childId ? [['tasks', childId], ['task', row?.id ?? ''], ['tasks', 'pending'], ['balance']] : [['tasks'], ['balance']];
    case 'goals':
      return [['goals', ...(childId ? [childId] : [])]];
    case 'rewards':
      return [['rewards']];
    // soldes et demandes : petites requêtes, partagées parent/enfants → invalidation par préfixe
    case 'reward_requests':
      return [['requests'], ['balance']];
    case 'point_transactions':
      return [['balance'], ['transactions']];
    case 'children':
      return [['me']];
  }
}
