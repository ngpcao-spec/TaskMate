import { resolveDisplayedChild } from './displayed-child';

const minh = { id: 'c-minh', name: 'Minh' };
const khang = { id: 'c-khang', name: 'Khang' };
const cam = { id: 'c-cam', name: 'Cam' };

describe('resolveDisplayedChild (D-052)', () => {
  it('enfant : toujours SON profil, jamais un autre — même si la liste (cache) contient les autres enfants', () => {
    const r = resolveDisplayedChild({ role: 'child', memberChildId: 'c-minh', children: [khang, minh, cam], selectedId: null });
    expect(r).toEqual({ children: [minh], child: minh, displayedId: 'c-minh' });
  });
  it('enfant : une sélection résiduelle (état d\'un parent sur le même appareil) est ignorée', () => {
    const r = resolveDisplayedChild({ role: 'child', memberChildId: 'c-minh', children: [minh, khang], selectedId: 'c-khang' });
    expect(r.child).toBe(minh);
    expect(r.children).toEqual([minh]);
  });
  it('enfant dont le profil est absent : aucun enfant affiché (jamais un autre par défaut)', () => {
    const r = resolveDisplayedChild({ role: 'child', memberChildId: 'c-minh', children: [khang], selectedId: null });
    expect(r).toEqual({ children: [], child: null, displayedId: null });
    expect(resolveDisplayedChild({ role: 'child', memberChildId: null, children: [khang], selectedId: null }).child).toBeNull();
  });
  it('parent : tous les enfants, le premier par défaut', () => {
    const r = resolveDisplayedChild({ role: 'parent', memberChildId: null, children: [minh, khang, cam], selectedId: null });
    expect(r.children).toEqual([minh, khang, cam]);
    expect(r.child).toBe(minh);
  });
  it('parent : l\'enfant sélectionné ; une sélection inconnue retombe sur le premier', () => {
    expect(resolveDisplayedChild({ role: 'parent', memberChildId: null, children: [minh, khang], selectedId: 'c-khang' }).child).toBe(khang);
    expect(resolveDisplayedChild({ role: 'parent', memberChildId: null, children: [minh, khang], selectedId: 'c-supprime' }).child).toBe(minh);
  });
  it('parent sans enfant', () => {
    expect(resolveDisplayedChild({ role: 'parent', memberChildId: null, children: [], selectedId: 'x' })).toEqual({ children: [], child: null, displayedId: null });
  });
});
