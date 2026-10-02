/**
 * Erreur « transitoire » (réseau coupé, serveur indisponible) : la mutation doit être rejouée.
 * Les erreurs métier (RLS, RPC `task_not_found`, `forbidden`…) sont définitives : rollback + message.
 */
export function isTransientError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const e = error as { message?: unknown; status?: unknown; code?: unknown };
  if (typeof e.status === 'number' && (e.status >= 500 || e.status === 408 || e.status === 429)) return true;
  const message = typeof e.message === 'string' ? e.message : '';
  return /network request failed|failed to fetch|network error|timeout|timed out|load failed|fetch failed/i.test(message);
}
