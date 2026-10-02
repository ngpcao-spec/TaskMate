import type { RequestStatus } from '@/types/models';

export type BalanceSnapshot = { balance: number; reserved: number; available: number; pendingTaskPoints: number };

/** Récompense accessible ? Le coût se compare au solde DISPONIBLE (solde − points réservés) — SPEC §3.7. */
export const canAfford = (available: number, cost: number): boolean => cost <= available;

export function projectBalance(base: BalanceSnapshot, delta: number): BalanceSnapshot {
  return { ...base, balance: base.balance + delta, available: base.available + delta };
}

export type RequestLike = { status: RequestStatus; created_at: string; expires_at: string; cost: number };

export const REQUEST_WINDOW_DAYS = 30;

/** Demandes des 30 derniers jours, en attente d'abord puis les plus récentes (SPEC §3.7 « Demandes »). */
export function recentRequests<T extends RequestLike>(requests: readonly T[], now: Date): T[] {
  const since = now.getTime() - REQUEST_WINDOW_DAYS * 24 * 3600 * 1000;
  return requests
    .filter((r) => new Date(r.created_at).getTime() >= since)
    .sort((a, b) => {
      const pa = a.status === 'pending' ? 0 : 1;
      const pb = b.status === 'pending' ? 0 : 1;
      return pa !== pb ? pa - pb : b.created_at.localeCompare(a.created_at);
    });
}

/** Total réservé par les demandes en attente non échues (cohérent avec la vue `child_balances`). */
export function reservedByPending(requests: readonly RequestLike[], now: Date): number {
  return requests
    .filter((r) => r.status === 'pending' && new Date(r.expires_at).getTime() > now.getTime())
    .reduce((s, r) => s + r.cost, 0);
}

/** Jours restants avant expiration d'une demande en attente (arrondi au supérieur, min 0). */
export function daysUntilExpiry(expiresAt: string, now: Date): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / (24 * 3600 * 1000)));
}

/** Montant saisi + signe → delta entier non nul, sinon null. */
export function parseAdjustment(amount: string, sign: 1 | -1): number | null {
  const n = Number(amount.trim());
  if (!Number.isInteger(n) || n <= 0 || n > 100_000) return null;
  return sign * n;
}
