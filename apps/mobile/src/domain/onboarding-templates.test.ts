import { clampCost, clampPoints, REWARD_TEMPLATES, rewardInputs, TASK_TEMPLATES, taskRecurrences } from './onboarding-templates';
import { REWARD_ICON_NAMES } from '@/components/RewardIcon';
import { TASK_CATEGORIES } from '@/theme/categories';

describe('modèles de départ', () => {
  it('8 tâches et 4 récompenses, clés uniques', () => {
    expect(TASK_TEMPLATES).toHaveLength(8);
    expect(REWARD_TEMPLATES).toHaveLength(4);
    expect(new Set(TASK_TEMPLATES.map((t) => t.key)).size).toBe(8);
    expect(new Set(REWARD_TEMPLATES.map((t) => t.key)).size).toBe(4);
  });
  it('catégories et icônes valides ; points et coûts dans les bornes de la base', () => {
    for (const t of TASK_TEMPLATES) {
      expect(TASK_CATEGORIES).toContain(t.category);
      expect(t.points).toBeGreaterThanOrEqual(0);
      expect(t.points).toBeLessThanOrEqual(1000);
    }
    for (const r of REWARD_TEMPLATES) {
      expect(REWARD_ICON_NAMES).toContain(r.icon);
      expect(r.cost).toBeGreaterThan(0);
    }
  });
  it('récurrence cohérente avec la règle : « jours choisis » ⇒ jours ISO 1–7 non vides ; « quotidienne » ⇒ aucun jour', () => {
    for (const t of TASK_TEMPLATES) {
      if (t.rule === 'daily') expect(t.weekdays).toBeNull();
      else {
        expect(t.weekdays?.length).toBeGreaterThan(0);
        for (const d of t.weekdays ?? []) expect(d >= 1 && d <= 7).toBe(true);
      }
    }
  });
  it('un enfant régulier gagne ~25–35 points par jour : la plus petite récompense reste atteignable en 2 jours, la plus grande en ~4', () => {
    const daily = TASK_TEMPLATES.filter((t) => t.rule === 'daily').reduce((s, t) => s + t.points, 0);
    const weekday = TASK_TEMPLATES.find((t) => t.key === 'homework')?.points ?? 0;
    expect(daily + weekday).toBeGreaterThanOrEqual(25);
    expect(daily + weekday).toBeLessThanOrEqual(40);
    const costs = REWARD_TEMPLATES.map((r) => r.cost);
    expect(Math.min(...costs)).toBeLessThanOrEqual(2 * (daily + weekday));
    expect(Math.max(...costs)).toBeLessThanOrEqual(4 * (daily + weekday));
  });
});

describe('séries à créer', () => {
  const find = (k: string) => TASK_TEMPLATES.find((t) => t.key === k)!;
  it('une série par (enfant × modèle), sans heure, le jour local donné, jours copiés', () => {
    const out = taskRecurrences({ c1: [{ template: find('homework'), title: 'Làm bài tập', points: 20 }], c2: [{ template: find('brushTeeth'), title: 'Đánh răng', points: 5 }, { template: find('tidyRoom'), title: 'Dọn phòng', points: 10 }] }, '2026-10-20');
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({ child_id: 'c1', title: 'Làm bài tập', category: 'study', note: null, time_kind: 'anytime', start_time: null, end_time: null, points: 20, rule: 'weekdays', weekdays: [1, 2, 3, 4, 5], starts_on: '2026-10-20' });
    expect(out[1]).toMatchObject({ child_id: 'c2', rule: 'daily', weekdays: null });
    expect(out[2]).toMatchObject({ rule: 'weekdays', weekdays: [6] });
  });
  it('points bornés, titre coupé à 80, titre vide ignoré, tableau d’origine jamais modifié', () => {
    const t = find('tidyRoom');
    const out = taskRecurrences({ c1: [{ template: t, title: 'x'.repeat(120), points: 99999 }, { template: t, title: '   ', points: 10 }] }, '2026-10-20');
    expect(out).toHaveLength(1);
    expect(out[0]?.title).toHaveLength(80);
    expect(out[0]?.points).toBe(1000);
    out[0]?.weekdays?.push(1);
    expect(t.weekdays).toEqual([6]);
  });
  it('aucun enfant coché : rien', () => expect(taskRecurrences({}, '2026-10-20')).toEqual([]));
});

describe('récompenses', () => {
  it('communes à la famille, coût borné, titre vide ignoré', () => {
    const r = REWARD_TEMPLATES[0]!;
    expect(rewardInputs([{ template: r, title: ' 30 phút chơi game ', cost: 70 }, { template: r, title: '', cost: 10 }, { template: r, title: 'x', cost: -5 }])).toEqual([
      { title: '30 phút chơi game', icon: 'gamepad-2', cost: 70, childId: null },
      { title: 'x', icon: 'gamepad-2', cost: 1, childId: null },
    ]);
  });
  it('bornes', () => {
    expect(clampPoints(NaN)).toBe(0);
    expect(clampPoints(-3)).toBe(0);
    expect(clampPoints(12.9)).toBe(12);
    expect(clampCost(0)).toBe(1);
    expect(clampCost(1e9)).toBe(100000);
    expect(clampCost(NaN)).toBe(1);
  });
});
