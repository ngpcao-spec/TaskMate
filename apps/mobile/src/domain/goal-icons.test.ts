import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { CATEGORY_ICON, GOAL_ICONS, goalIconFor, isGoalIcon, WEEKLY_REVIEW_ICON } from './goal-icons';
import { TASK_CATEGORIES } from '@/theme/categories';

describe('icônes d’objectifs (D-106)', () => {
  it('36 slugs uniques, chacun avec son image', () => {
    expect(GOAL_ICONS).toHaveLength(36);
    expect(new Set(GOAL_ICONS).size).toBe(36);
    const files = readdirSync(join(__dirname, '../../assets/v2/goals')).filter((f) => f.endsWith('.webp'));
    expect(files.map((f) => f.replace(/^goal-/, '').replace(/\.webp$/, '')).sort()).toEqual([...GOAL_ICONS].sort());
  });
  it('même liste que goal_icon_slugs() dans la migration 37', () => {
    const sql = readFileSync(join(__dirname, '../../../../supabase/migrations/20260702000037_v2.sql'), 'utf8');
    const start = sql.indexOf('array[', sql.indexOf('goal_icon_slugs() returns'));
    const body = sql.slice(start, sql.indexOf(']', start));
    const slugs = [...body.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
    expect(slugs).toEqual([...GOAL_ICONS]);
  });
  it('icône par défaut de chaque catégorie', () => {
    for (const c of TASK_CATEGORIES) expect(isGoalIcon(CATEGORY_ICON[c])).toBe(true);
    expect(goalIconFor({ category: 'study' })).toBe('devoirs');
    expect(goalIconFor({ category: 'sport' })).toBe('course');
    expect(goalIconFor({ category: 'chores' })).toBe('ranger');
    expect(goalIconFor({ category: 'personal' })).toBe('brosse-a-dents');
    expect(goalIconFor({ category: 'other' })).toBe('reveil');
  });
  it('l’icône choisie l’emporte ; une icône inconnue retombe sur la catégorie', () => {
    expect(goalIconFor({ icon: 'piano', category: 'study' })).toBe('piano');
    expect(goalIconFor({ icon: 'licorne', category: 'sport' })).toBe('course');
    expect(goalIconFor({ icon: null, category: 'chores' })).toBe('ranger');
    expect(goalIconFor({ icon: null, category: 'inconnue' })).toBe('reveil');
    expect(goalIconFor({})).toBe('reveil');
    expect(isGoalIcon(3)).toBe(false);
    expect(WEEKLY_REVIEW_ICON).toBe('devoirs');
  });
});
