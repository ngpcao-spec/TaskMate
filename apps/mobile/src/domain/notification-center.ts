/** Centre de notifications intégré (W3) : compteur de non lues, calculé localement à partir d'un « vu le ». */

export type Timed = { at: string };

export function latestAt(rows: readonly Timed[]): string | null {
  let best: string | null = null;
  for (const r of rows) if (best === null || new Date(r.at).getTime() > new Date(best).getTime()) best = r.at;
  return best;
}

/** Nombre d'éléments plus récents que `lastSeenAt` (null = jamais ouvert → tout est non lu). */
export function unreadCount(rows: readonly Timed[], lastSeenAt: string | null): number {
  if (lastSeenAt === null) return rows.length;
  const seen = new Date(lastSeenAt).getTime();
  return rows.filter((r) => new Date(r.at).getTime() > seen).length;
}

/** Badge d'icône / titre de l'onglet : non lues + éléments à valider. */
export const badgeTotal = (unread: number, approvals: number): number => Math.max(0, unread) + Math.max(0, approvals);

export const documentTitleFor = (total: number, base = 'TaskMate'): string => (total > 0 ? `(${total > 99 ? '99+' : total}) ${base}` : base);
