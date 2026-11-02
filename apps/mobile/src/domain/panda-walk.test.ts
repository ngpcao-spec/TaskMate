import { pandaWalks, WALK_MIN_RANGE, WALK_SPEED, walkPlan } from './panda-walk';

describe('promenade du panda (D-106)', () => {
  it('marche sauf endormi, en voyage ou avec « réduire les animations »', () => {
    expect(pandaWalks({ mood: 'calme', travelling: false, reduceMotion: false })).toBe(true);
    expect(pandaWalks({ mood: 'tres-heureux', travelling: false, reduceMotion: false })).toBe(true);
    expect(pandaWalks({ mood: 'dort', travelling: false, reduceMotion: false })).toBe(false);
    expect(pandaWalks({ mood: 'calme', travelling: true, reduceMotion: false })).toBe(false);
    expect(pandaWalks({ mood: 'calme', travelling: false, reduceMotion: true })).toBe(false);
  });
  it('plan : d’un bord à l’autre, départ au centre, vitesse calme', () => {
    expect(walkPlan(316, 116)).toEqual({ range: 200, start: 100, crossMs: Math.round((200 / WALK_SPEED) * 1000), firstLegMs: Math.round((100 / WALK_SPEED) * 1000) });
    expect(walkPlan(317.6, 116)?.range).toBe(201);
  });
  it('panneau trop étroit ou largeur inconnue : pas de marche', () => {
    expect(walkPlan(116 + WALK_MIN_RANGE - 1, 116)).toBeNull();
    expect(walkPlan(116 + WALK_MIN_RANGE, 116)).not.toBeNull();
    expect(walkPlan(0, 116)).toBeNull();
    expect(walkPlan(Number.NaN, 116)).toBeNull();
  });
});
