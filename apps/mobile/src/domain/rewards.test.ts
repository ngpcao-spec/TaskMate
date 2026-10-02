import { canAfford, daysUntilExpiry, parseAdjustment, pendingPointsDelta, projectBalance, recentRequests, reservedByPending, type RequestLike } from './rewards';

const now = new Date('2026-07-02T00:00:00Z');
const req = (over: Partial<RequestLike>): RequestLike => ({ status: 'pending', created_at: '2026-07-01T00:00:00Z', expires_at: '2026-07-08T00:00:00Z', cost: 100, ...over });

describe('canAfford', () => {
  it('compare au disponible, pas au solde', () => {
    expect(canAfford(100, 100)).toBe(true);
    expect(canAfford(99, 100)).toBe(false);
  });
});

describe('solde projeté', () => {
  it('ajoute les coches en attente et retire les décoches', () => {
    expect(pendingPointsDelta([{ completed: true, points: 10 }, { completed: true, points: 5 }, { completed: false, points: 10 }])).toBe(5);
    expect(pendingPointsDelta([])).toBe(0);
  });
  it('ne touche pas le réservé', () => {
    expect(projectBalance({ balance: 300, reserved: 100, available: 200 }, 10)).toEqual({ balance: 310, reserved: 100, available: 210 });
  });
});

describe('demandes', () => {
  it('garde les 30 derniers jours, en attente d’abord, récentes ensuite', () => {
    const list = recentRequests(
      [
        req({ status: 'approved', created_at: '2026-06-30T00:00:00Z' }),
        req({ status: 'pending', created_at: '2026-06-25T00:00:00Z' }),
        req({ status: 'rejected', created_at: '2026-06-01T00:00:00Z' }), // 31 j → exclue
        req({ status: 'rejected', created_at: '2026-07-01T00:00:00Z' }),
      ],
      now,
    );
    expect(list.map((r) => `${r.status}@${r.created_at.slice(0, 10)}`)).toEqual(['pending@2026-06-25', 'rejected@2026-07-01', 'approved@2026-06-30']);
  });
  it('le réservé ignore les demandes échues ou traitées', () => {
    expect(reservedByPending([req({}), req({ cost: 50 }), req({ status: 'approved' }), req({ expires_at: '2026-07-01T00:00:00Z' })], now)).toBe(150);
  });
  it('jours avant expiration', () => {
    expect(daysUntilExpiry('2026-07-08T00:00:00Z', now)).toBe(6);
    expect(daysUntilExpiry('2026-07-02T12:00:00Z', now)).toBe(1);
    expect(daysUntilExpiry('2026-06-01T00:00:00Z', now)).toBe(0);
  });
});

describe('parseAdjustment', () => {
  it('signe et montant', () => {
    expect(parseAdjustment('50', 1)).toBe(50);
    expect(parseAdjustment(' 20 ', -1)).toBe(-20);
  });
  it.each(['', '0', '-5', '1.5', 'abc', '1000000'])('refuse « %s »', (v) => expect(parseAdjustment(v, 1)).toBeNull());
});
