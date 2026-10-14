import { savePrefs } from '@/api/notifications';
import { DEFAULT_PREFS } from '@/domain/notification-prefs';

type Result = { data?: { member_id: string }[]; error: { code?: string; message?: string } | null };
const mockCalls: string[] = [];
let mockUpdates: Result[] = [];
let mockInserts: Result[] = [];

jest.mock('@/sync/storage', () => ({ kvStorage: { getItem: jest.fn(() => null), setItem: jest.fn(), removeItem: jest.fn() } }));
jest.mock('@/api/supabase', () => ({
  supabase: {
    from: (table: string) => {
      mockCalls.push(`from:${table}`);
      return {
        update: (v: unknown) => {
          mockCalls.push(`update:${JSON.stringify(v)}`);
          return { eq: (c: string, id: string) => { mockCalls.push(`eq:${c}=${id}`); return { select: async () => mockUpdates.shift() ?? { data: [], error: null } }; } };
        },
        insert: async (v: unknown) => { mockCalls.push(`insert:${JSON.stringify(v)}`); return mockInserts.shift() ?? { error: null }; },
        upsert: () => { throw new Error('upsert interdit : il réécrit member_id (403)'); },
      };
    },
  },
}));

const prefs = { ...DEFAULT_PREFS };
beforeEach(() => { mockCalls.length = 0; mockUpdates = []; mockInserts = []; });

describe('savePrefs (D-066 : plus d’upsert, qui réécrit member_id)', () => {
  it('ligne existante : un seul UPDATE de prefs, jamais d’insertion ni d’upsert', async () => {
    mockUpdates = [{ data: [{ member_id: 'm1' }], error: null }];
    await savePrefs('m1', prefs);
    expect(mockCalls).toContain(`update:${JSON.stringify({ prefs })}`);
    expect(mockCalls).toContain('eq:member_id=m1');
    expect(mockCalls.some((c) => c.startsWith('insert:'))).toBe(false);
  });

  it('première fois (aucune ligne) : UPDATE vide puis INSERT avec member_id', async () => {
    mockUpdates = [{ data: [], error: null }];
    await savePrefs('m1', prefs);
    expect(mockCalls).toContain(`insert:${JSON.stringify({ member_id: 'm1', prefs })}`);
  });

  it('deux enregistrements simultanés (clé déjà prise, 23505) : on remet à jour', async () => {
    mockUpdates = [{ data: [], error: null }, { data: [{ member_id: 'm1' }], error: null }];
    mockInserts = [{ error: { code: '23505' } }];
    await expect(savePrefs('m1', prefs)).resolves.toBeUndefined();
    expect(mockCalls.filter((c) => c.startsWith('update:'))).toHaveLength(2);
  });

  it('autre erreur d’insertion, ou 23505 sans ligne retrouvée : l’erreur remonte', async () => {
    mockUpdates = [{ data: [], error: null }];
    mockInserts = [{ error: { code: '42501', message: 'refusé' } }];
    await expect(savePrefs('m1', prefs)).rejects.toMatchObject({ code: '42501' });
    mockUpdates = [{ data: [], error: null }, { data: [], error: null }];
    mockInserts = [{ error: { code: '23505' } }];
    await expect(savePrefs('m1', prefs)).rejects.toMatchObject({ code: '23505' });
  });

  it('erreur à la mise à jour : elle remonte, sans insertion', async () => {
    mockUpdates = [{ error: { code: '42501', message: 'refusé' } }];
    await expect(savePrefs('m1', prefs)).rejects.toMatchObject({ code: '42501' });
    expect(mockCalls.some((c) => c.startsWith('insert:'))).toBe(false);
  });
});
