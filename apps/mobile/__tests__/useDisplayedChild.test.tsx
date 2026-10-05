import { renderHook } from '@testing-library/react-native';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useSessionStore } from '@/store/session';

const minh = { id: 'c-minh', name: 'Minh', birth_date: '2009-03-01', color: null };
const khang = { id: 'c-khang', name: 'Khang', birth_date: '2013-05-01', color: null };
let mockMe: unknown = null;
jest.mock('@/hooks/useMe', () => ({ useMe: () => ({ data: mockMe }) }));

const meOf = (role: 'parent' | 'child', childId: string | null) => ({ member: { id: 'm', role, child_id: childId }, family: { id: 'f', timezone: 'Asia/Ho_Chi_Minh' }, children: [minh, khang] });

describe('useDisplayedChild (D-052)', () => {
  beforeEach(() => useSessionStore.setState({ displayedChildId: null }));

  it('enfant : toujours le sien, sans sélection ; la sélection d\'un parent précédent est ignorée et select ne fait rien', async () => {
    mockMe = meOf('child', 'c-minh');
    useSessionStore.setState({ displayedChildId: 'c-khang' }); // reliquat d'un parent sur le même appareil
    const { result } = await renderHook(() => useDisplayedChild());
    expect(result.current?.child?.id).toBe('c-minh');
    expect(result.current?.children.map((c) => c.id)).toEqual(['c-minh']); // le cache contient les deux, l'enfant n'en reçoit qu'un
    result.current?.select('c-khang');
    expect(useSessionStore.getState().displayedChildId).toBe('c-khang'); // inchangé : l'appel est sans effet
    expect(result.current?.child?.id).toBe('c-minh');
    expect(result.current).not.toHaveProperty('readOnly'); // plus de notion de « profil du frère en lecture seule »
  });

  it('parent : tous les enfants, sélection possible', async () => {
    mockMe = meOf('parent', null);
    const { result, rerender } = await renderHook(() => useDisplayedChild());
    expect(result.current?.children.map((c) => c.id)).toEqual(['c-minh', 'c-khang']);
    expect(result.current?.child?.id).toBe('c-minh');
    useSessionStore.getState().setDisplayedChildId('c-khang');
    await rerender(undefined);
    expect(result.current?.child?.id).toBe('c-khang');
    expect(result.current?.viewer).toEqual({ role: 'parent', memberId: 'm', childId: null });
  });

  it('sans données : null', async () => {
    mockMe = null;
    const { result } = await renderHook(() => useDisplayedChild());
    expect(result.current).toBeNull();
  });
});
