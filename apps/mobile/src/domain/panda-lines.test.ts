import en from '@/i18n/locales/en.json';
import fr from '@/i18n/locales/fr.json';
import vi from '@/i18n/locales/vi.json';
import { greetingFor, inviteSituation, LINE_VARIANTS, PANDA_SITUATIONS, pandaLineKey, pandaLineKeys, pandaLineParams, pandaSituation, pickPandaLine, STORY_DESTINATIONS, storySituation } from './panda-lines';
import type { PandaStage } from './panda';

const STAGES: PandaStage[] = [1, 2, 3, 4];
const LOCALES = { vi, fr, en } as const;
const lookup = (locale: unknown, key: string): unknown => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], locale);

describe('clés de répliques', () => {
  it('clé = panda.lines.<situation>.s<stade>.v<n>, variante ramenée dans l’intervalle', () => {
    expect(pandaLineKey(2, 'task_checked', 0)).toBe('panda.lines.task_checked.s2.v1');
    expect(pandaLineKey(2, 'task_checked', 4)).toBe('panda.lines.task_checked.s2.v2');
    expect(pandaLineKey(1, 'greeting_morning', -1)).toBe('panda.lines.greeting_morning.s1.v2');
    expect(pandaLineKeys(4, 'nothing_yet_evening')).toHaveLength(LINE_VARIANTS.nothing_yet_evening);
  });
  it('2 à 3 variantes par situation (2 pour les aventures)', () => {
    for (const s of PANDA_SITUATIONS) expect([2, 3]).toContain(LINE_VARIANTS[s]);
  });
});

describe('textes dans les trois langues', () => {
  const every = PANDA_SITUATIONS.flatMap((s) => STAGES.flatMap((st) => pandaLineKeys(st, s)));
  it.each(Object.entries(LOCALES))('%s : toutes les répliques existent et ne sont pas vides', (_name, locale) => {
    for (const key of every) {
      const text = lookup(locale, key);
      expect(typeof text).toBe('string');
      expect((text as string).trim().length).toBeGreaterThan(0);
    }
  });
  it.each(Object.entries(LOCALES))('%s : aucune variable inconnue dans les textes', (_name, locale) => {
    for (const key of every) {
      for (const m of (lookup(locale, key) as string).matchAll(/\{\{(\w+)\}\}/g)) expect(['name', 'energy', 'quizEnergy', 'destination']).toContain(m[1]);
    }
  });
  it('le panda ne parle jamais d’un frère ou d’une sœur, ne pousse pas à acheter et ne donne pas de réponse', () => {
    const banned = [
      /fr[èe]re|s[œo]eur|sibling|brother|sister/i,
      /(^|[^\p{L}])(anh|ch[ịi]|em)([^\p{L}]|$)/iu, // anh / chị / em : termes de fratrie en vietnamien
      /acheter|achat|boutique|shop|buy|purchase|r[ée]compense|reward/i,
      /(^|[^\p{L}])(mua|cửa hàng|phần thưởng)([^\p{L}]|$)/iu,
      /r[ée]ponse|answer|đáp án|correct/i,
    ];
    for (const locale of Object.values(LOCALES)) {
      for (const key of every) for (const re of banned) expect(lookup(locale, key) as string).not.toMatch(re);
    }
  });
  it('pronoms vietnamiens : tớ – cậu aux stades 1 et 2, mình – bạn aux stades 3 et 4', () => {
    const texts = (st: PandaStage) => PANDA_SITUATIONS.flatMap((s) => pandaLineKeys(st, s)).map((k) => lookup(vi, k) as string);
    for (const st of [1, 2] as const) for (const x of texts(st)) expect(x).not.toMatch(/(^|[^\p{L}])bạn([^\p{L}]|$)/iu);
    for (const st of [3, 4] as const) for (const x of texts(st)) expect(x).not.toMatch(/(^|[^\p{L}])(tớ|cậu)([^\p{L}]|$)/iu);
  });
  it('stade 1 : le panda dit « Panda » ou le prénom de l’enfant, phrases courtes', () => {
    for (const s of PANDA_SITUATIONS) {
      for (const key of pandaLineKeys(1, s)) {
        const text = lookup(vi, key) as string;
        expect(text.split(/\s+/).length).toBeLessThanOrEqual(9);
      }
    }
    expect(lookup(vi, 'panda.lines.task_checked.s1.v1')).toBe('Giỏi quá, {{name}} ơi! Panda vui lắm!');
  });
  it('exemples imposés', () => {
    expect(lookup(vi, 'panda.lines.task_checked.s2.v1')).toBe('Yeah! Tớ với cậu thêm {{energy}} năng lượng rồi!');
    expect(lookup(vi, 'panda.lines.task_checked.s3.v1')).toBe('Ổn áp đấy. Thêm {{energy}} năng lượng, chuyến phiêu lưu sắp đủ rồi.');
    expect(lookup(vi, 'panda.lines.task_checked.s4.v1')).toBe('Đã xong. Một bước nữa cho mục tiêu tuần này.');
    expect(lookup(vi, 'panda.lines.nothing_yet_evening.s3.v1')).toBe('Hôm nay hơi bận hả? Mai mình làm tiếp.');
  });
  it('aventures (D-105) : exemples imposés, une ligne de récit par destination, jamais de culpabilité', () => {
    expect(lookup(vi, 'panda.lines.story_ha_long.s2.v1')).toBe('Tớ đã đi thuyền ở Vịnh Hạ Long! Xem tớ mang gì về cho cậu này!');
    expect(lookup(vi, 'panda.lines.adventure_duplicate.s2.v1')).toBe('Cái này cậu có rồi, nhưng tớ thích quá nên mang thêm một cái!');
    for (const d of STORY_DESTINATIONS) expect(storySituation(d)).toBe(`story_${d.replace(/-/g, '_')}`);
    expect(storySituation('atlantide')).toBeNull();
    for (const locale of Object.values(LOCALES)) {
      for (const s of ['adventure_ready', 'adventure_away', 'adventure_back', 'adventure_duplicate', ...STORY_DESTINATIONS.map((d) => storySituation(d)!)] as const) {
        for (const st of STAGES) for (const key of pandaLineKeys(st, s)) expect(lookup(locale, key) as string).not.toMatch(/nourri|affamé|faim|hungry|starv|fed me|đói|bỏ rơi|perdu|lost|triste|sad|buồn/i);
      }
    }
  });
  it('grand départ (D-107) : invitation par destination, départ, mot, retour avec le paquet ; exemple imposé ; jamais de culpabilité', () => {
    expect(lookup(vi, 'panda.lines.adventure_invite_ha_long.s2.v1')).toBe('Cậu muốn đi thuyền ở Vịnh Hạ Long với tớ không?');
    expect(lookup(vi, 'panda.lines.adventure_leave.s2.v1')).toBe('Đi thôi! Sáng mai tớ về nhé!');
    expect(lookup(vi, 'panda.lines.adventure_note.s2.v1')).toBe('Tớ đi {{destination}}, sáng mai về nhé!');
    expect(lookup(vi, 'panda.lines.adventure_home_gift.s2.v1')).toBe('Tớ về rồi! Có quà cho {{name}} nè!');
    for (const d of STORY_DESTINATIONS) expect(inviteSituation(d)).toBe(`adventure_invite_${d.replace(/-/g, '_')}`);
    expect(inviteSituation('atlantide')).toBeNull();
    const trip = ['adventure_leave', 'adventure_note', 'adventure_home_gift', ...STORY_DESTINATIONS.map((d) => inviteSituation(d)!)] as const;
    for (const locale of Object.values(LOCALES)) {
      for (const s of trip) {
        for (const st of STAGES) for (const key of pandaLineKeys(st, s)) expect(lookup(locale, key) as string).not.toMatch(/nourri|affamé|faim|hungry|starv|fed me|đói|bỏ rơi|perdu|lost|triste|sad|buồn|vite|hurry|nhanh lên/i);
      }
      // le mot sur la porte nomme toujours la destination
      for (const st of STAGES) for (const key of pandaLineKeys(st, 'adventure_note')) expect(lookup(locale, key) as string).toContain('{{destination}}');
    }
  });
  it('« nothing_yet_evening » : jamais de reproche', () => {
    for (const locale of Object.values(LOCALES)) {
      for (const st of STAGES) for (const key of pandaLineKeys(st, 'nothing_yet_evening')) expect(lookup(locale, key) as string).not.toMatch(/pas fait|jamais|paresse|lazy|never|failed|lười|không làm/i);
    }
  });
  it('valeurs d’interpolation', () => {
    expect(pandaLineParams('Minh')).toEqual({ name: 'Minh', energy: 0, quizEnergy: 0, destination: '' });
    // D-106 : l'énergie affichée vient des points (tâche, quiz), jamais d'une constante
    expect(pandaLineParams('Minh', '', { energy: 10, quizEnergy: 8 })).toEqual({ name: 'Minh', energy: 10, quizEnergy: 8, destination: '' });
    expect(pandaLineParams('Minh', '', { energy: -4.5 }).energy).toBe(0);
    expect(pandaLineParams('Minh', 'Vịnh Hạ Long').destination).toBe('Vịnh Hạ Long');
  });
});

describe('choix de la situation', () => {
  const base = { done: 0, total: 3, localHour: 10 };
  it('salutation selon l’heure locale', () => {
    expect(greetingFor(7)).toBe('greeting_morning');
    expect(greetingFor(12)).toBe('greeting_afternoon');
    expect(greetingFor(17)).toBe('greeting_afternoon');
    expect(greetingFor(18)).toBe('greeting_evening');
    expect(pandaSituation({ ...base, localHour: 7 })).toBe('greeting_morning');
    expect(pandaSituation({ ...base, localHour: 14 })).toBe('greeting_afternoon');
    expect(pandaSituation({ ...base, localHour: 19 })).toBe('greeting_evening');
  });
  it('rien de fait le soir (à partir de 20 h) : nothing_yet_evening, sans reproche', () => {
    expect(pandaSituation({ ...base, localHour: 20 })).toBe('nothing_yet_evening');
    expect(pandaSituation({ done: 0, total: 0, localHour: 21 })).toBe('nothing_yet_evening');
    expect(pandaSituation({ done: 1, total: 3, localHour: 21 })).toBe('greeting_evening');
  });
  it('tout fait : all_done', () => {
    expect(pandaSituation({ done: 3, total: 3, localHour: 10 })).toBe('all_done');
    expect(pandaSituation({ done: 0, total: 0, localHour: 10 })).toBe('greeting_morning');
  });
  it('événements : coche, dernière coche, quiz validé', () => {
    expect(pandaSituation({ ...base, done: 1, event: 'checked' })).toBe('task_checked');
    expect(pandaSituation({ done: 3, total: 3, localHour: 10, event: 'checked' })).toBe('all_done');
    expect(pandaSituation({ ...base, event: 'quiz' })).toBe('quiz_validated');
  });
  it('pickPandaLine : clé du stade, variante tournante selon la graine', () => {
    expect(pickPandaLine({ stage: 3, ...base, event: 'checked', seed: 0 })).toEqual({ situation: 'task_checked', key: 'panda.lines.task_checked.s3.v1' });
    expect(pickPandaLine({ stage: 3, ...base, event: 'checked', seed: 1 }).key).toBe('panda.lines.task_checked.s3.v2');
    expect(pickPandaLine({ stage: 4, ...base }).key).toBe('panda.lines.greeting_morning.s4.v1');
  });
});
