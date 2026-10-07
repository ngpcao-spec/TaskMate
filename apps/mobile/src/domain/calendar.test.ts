import { getISODay, parseISO } from 'date-fns';
import {
  categoryTint,
  formatDayNumber,
  formatShortDate,
  formatDayTitle,
  formatMonthTitle,
  formatWeekdayLabel,
  groupByDay,
  shiftDay,
  shiftWeek,
  weekDays,
  weekStart,
} from './calendar';

describe('semaine lundi → dimanche', () => {
  it('un jeudi appartient à la semaine du lundi précédent', () => {
    expect(weekStart('2026-07-02')).toBe('2026-06-29');
    expect(weekDays('2026-07-02')).toEqual([
      '2026-06-29', '2026-06-30', '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05',
    ]);
  });
  it('le dimanche clôt la semaine (pas la suivante)', () => {
    expect(weekStart('2026-07-05')).toBe('2026-06-29');
    expect(weekStart('2026-07-06')).toBe('2026-07-06');
  });
  it('navigation semaine/jour, y compris à cheval sur un changement d’année', () => {
    expect(shiftWeek('2026-07-02', 1)).toBe('2026-07-09');
    expect(shiftWeek('2026-07-02', -1)).toBe('2026-06-25');
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
    expect(weekDays('2026-12-31')[0]).toBe('2026-12-28');
  });
});

describe('libellés calculés (jamais en dur)', () => {
  it('le 2 juillet 2026 est un JEUDI : Thứ Năm, sous la colonne T5 (incohérence des maquettes)', () => {
    expect(formatDayTitle('2026-07-02', 'vi')).toBe('Thứ Năm, 2 tháng 7');
    expect(formatWeekdayLabel('2026-07-02', 'vi')).toBe('T5');
  });
  it('titre et colonne restent cohérents pour toute la semaine', () => {
    const labels = weekDays('2026-07-02').map((d) => formatWeekdayLabel(d, 'vi'));
    expect(labels).toEqual(['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']);
    const titles = weekDays('2026-07-02').map((d) => formatDayTitle(d, 'vi').split(',')[0]);
    expect(titles).toEqual(['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật']);
  });
  it('autres langues et mois', () => {
    expect(formatDayTitle('2026-07-02', 'fr')).toBe('jeudi, 2 juillet');
    expect(formatDayTitle('2026-07-02', 'en')).toBe('Thursday, 2 July');
    expect(formatMonthTitle('2026-07-02', 'vi')).toBe('tháng 7 2026');
    expect(formatMonthTitle('2026-07-02', 'en')).toBe('July 2026');
    expect(formatWeekdayLabel('2026-07-02', 'en')).toBe('Th');
    expect(formatDayNumber('2026-07-02')).toBe('2');
    expect(formatShortDate('2026-07-02')).toBe('02/07/2026');
  });
});

describe('cartes et regroupement', () => {
  it('teinte de catégorie à ~12 %', () => {
    expect(categoryTint('study')).toBe('#2F80ED1F');
  });
  it('regroupe les tâches par jour et ignore celles hors semaine', () => {
    const days = weekDays('2026-07-02');
    const grouped = groupByDay([{ date: '2026-07-02', id: 'a' }, { date: '2026-07-02', id: 'b' }, { date: '2026-08-01', id: 'x' }], days);
    expect(grouped['2026-07-02']?.map((t) => t.id)).toEqual(['a', 'b']);
    expect(grouped['2026-06-29']).toEqual([]);
    expect(Object.keys(grouped)).toHaveLength(7);
  });
});

describe('choix du jour d\'une récurrence (TaskForm)', () => {
  it('la puce « T5 » enregistre le jeudi : ISO 4, et chaque puce correspond à son vrai jour ISO', () => {
    // même construction que TaskForm : puces = weekDays('2024-01-01') (un lundi), valeur = index + 1
    const chips = weekDays('2024-01-01').map((day, i) => ({ iso: i + 1, label: formatWeekdayLabel(day, 'vi'), real: getISODay(parseISO(day)) }));
    expect(chips.map((c) => c.label)).toEqual(['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']);
    for (const c of chips) expect(c.iso).toBe(c.real);
    expect(chips.find((c) => c.label === 'T5')).toMatchObject({ iso: 4 });
  });
  it('T5 → jeudi quel que soit le fuseau du test (Asia/Ho_Chi_Minh) : 2 juillet 2026 = jeudi = ISO 4', () => {
    expect(getISODay(parseISO('2026-07-02'))).toBe(4);
    expect(formatDayTitle('2026-07-02', 'vi').startsWith('Thứ Năm')).toBe(true);
  });
});
