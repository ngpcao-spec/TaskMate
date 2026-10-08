import {
  buildMessages,
  buildRecapMessages,
  buildWebMessages,
  buildWebRecapMessages,
  recapText,
  toLocale,
  textFor,
  type ActivityRecord,
  type DeviceInfo,
  type MemberInfo,
} from '../../../supabase/functions/send-push/logic';


const parent: MemberInfo = { id: 'p1', role: 'parent', child_id: null, display_name: 'Ba', prefs: null };
const minh: MemberInfo = { id: 'm-minh', role: 'child', child_id: 'c-minh', display_name: 'Minh', prefs: null };
const members = [parent, minh];
const act = (type: string, payload: Record<string, unknown> = {}, over: Partial<ActivityRecord> = {}): ActivityRecord => ({
  id: 'a1', family_id: 'f1', child_id: 'c-minh', actor_member_id: 'm-minh', type, payload: { title: 'Toán', ...payload }, ...over,
});
const LOCALES = ['vi', 'fr', 'en'] as const;
const ALL_TYPES = ['task_completed', 'task_validated', 'task_rejected', 'reward_requested', 'goal_achieved', 'reward_approved', 'reward_rejected', 'reward_expired', 'points_adjusted', 'task_assigned'];

describe('toLocale', () => {
  it('langues connues conservées, tout le reste → vietnamien', () => {
    expect(toLocale('fr')).toBe('fr');
    expect(toLocale('en')).toBe('en');
    expect(toLocale('vi')).toBe('vi');
    for (const v of [undefined, null, '', 'de', 'FR', 42, {}]) expect(toLocale(v)).toBe('vi');
  });
});

describe('textFor : une langue par appareil', () => {
  it('vietnamien par défaut (sans langue)', () => {
    expect(textFor(act('task_assigned'), 'Minh')?.body).toBe('Việc mới: Toán');
    expect(textFor(act('task_assigned'), 'Minh', 1, 'vi')?.body).toBe('Việc mới: Toán');
  });
  it('français et anglais', () => {
    expect(textFor(act('task_assigned'), 'Minh', 1, 'fr')?.body).toBe('Nouvelle tâche : Toán');
    expect(textFor(act('task_assigned'), 'Minh', 1, 'en')?.body).toBe('New task: Toán');
    expect(textFor(act('task_validated', { points: 10 }), 'Minh', 1, 'fr')?.body).toBe('Validée 🎉 Toán (+10 points)');
    expect(textFor(act('task_validated', { points: 10 }), 'Minh', 1, 'en')?.body).toBe('Approved 🎉 Toán (+10 points)');
    expect(textFor(act('task_rejected', { note: 'à refaire' }), 'Minh', 1, 'fr')?.body).toBe('Tâche refusée : Toán — à refaire');
    expect(textFor(act('task_rejected'), 'Minh', 1, 'en')?.body).toBe('Task declined: Toán');
  });
  it('coches groupées et demande d’échange portent les variables dans les trois langues', () => {
    expect(textFor(act('task_completed'), 'Minh', 3, 'vi')?.body).toBe('Minh đã hoàn thành 3 việc — chờ duyệt');
    expect(textFor(act('task_completed'), 'Minh', 3, 'fr')?.body).toBe('Minh a terminé 3 tâches — à valider');
    expect(textFor(act('task_completed'), 'Minh', 3, 'en')?.body).toBe('Minh finished 3 tasks — waiting for approval');
    expect(textFor(act('reward_requested', { cost: 100 }), 'Minh', 1, 'fr')?.body).toBe('Minh veut échanger : Toán (100 points)');
    expect(textFor(act('points_adjusted', { delta: -5 }), 'Minh', 1, 'en')?.body).toBe('Your points were adjusted -5');
    expect(textFor(act('points_adjusted', { delta: 5 }), 'Minh', 1, 'fr')?.body).toBe('Tes points ont été ajustés +5');
  });
  it('chaque type d’activité a un texte non vide dans chaque langue, sans « undefined » ni « NaN »', () => {
    for (const locale of LOCALES) {
      for (const type of ALL_TYPES) {
        const text = textFor(act(type, { points: 4, cost: 9, delta: 2, note: 'n' }), 'Minh', 1, locale);
        expect(text?.title).toBe('TaskMate');
        expect(text?.body.length).toBeGreaterThan(5);
        expect(text?.body).not.toMatch(/undefined|NaN|null|\{|\}/);
      }
    }
  });
  it('type inconnu → aucun texte, dans toutes les langues', () => {
    for (const locale of LOCALES) expect(textFor(act('weird'), 'Minh', 1, locale)).toBeNull();
  });
});

describe('push mobile : le texte suit la langue de l’appareil destinataire', () => {
  const devices: DeviceInfo[] = [
    { member_id: 'p1', expo_push_token: 'tok-fr', locale: 'fr' },
    { member_id: 'p1', expo_push_token: 'tok-en', locale: 'en' },
    { member_id: 'p1', expo_push_token: 'tok-vi', locale: 'vi' },
    { member_id: 'p1', expo_push_token: 'tok-none' },
    { member_id: 'p1', expo_push_token: 'tok-bad', locale: 'de' },
  ];
  it('un même événement donne un texte par langue ; absente ou inconnue → vietnamien', () => {
    const out = buildMessages(act('reward_requested', { cost: 50 }), members, devices, 'Minh');
    const byToken = Object.fromEntries(out.map((m) => [m.to, m.body]));
    expect(byToken['tok-fr']).toBe('Minh veut échanger : Toán (50 points)');
    expect(byToken['tok-en']).toBe('Minh wants to redeem: Toán (50 points)');
    expect(byToken['tok-vi']).toBe('Minh muốn đổi: Toán (50 điểm)');
    expect(byToken['tok-none']).toBe(byToken['tok-vi']);
    expect(byToken['tok-bad']).toBe(byToken['tok-vi']);
  });
  it('la langue ne change ni les destinataires ni les données de la notification', () => {
    const base = buildMessages(act('reward_requested'), members, devices.map((d) => ({ ...d, locale: 'vi' })), 'Minh');
    const mixed = buildMessages(act('reward_requested'), members, devices, 'Minh');
    expect(mixed.map((m) => [m.to, m.data, m.categoryId])).toEqual(base.map((m) => [m.to, m.data, m.categoryId]));
  });
  it('l’enfant reçoit dans SA langue, jamais celle du parent', () => {
    const d: DeviceInfo[] = [{ member_id: 'p1', expo_push_token: 'tok-p', locale: 'fr' }, { member_id: 'm-minh', expo_push_token: 'tok-m', locale: 'en' }];
    const out = buildMessages(act('task_validated', { points: 7 }, { actor_member_id: 'p1' }), members, d, 'Minh');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ to: 'tok-m', body: 'Approved 🎉 Toán (+7 points)' });
  });
  it('récap du soir dans la langue de chaque appareil', () => {
    const out = buildRecapMessages([parent], devices.slice(0, 3), [{ name: 'Minh', done: 3, total: 5 }], { tasks: 1, requests: 1 });
    const byToken = Object.fromEntries(out.map((m) => [m.to, m]));
    expect(byToken['tok-fr']).toMatchObject({ title: "Bilan d'aujourd'hui", body: 'Minh : 3/5 tâches · 2 à valider' });
    expect(byToken['tok-en']).toMatchObject({ title: "Today's summary", body: 'Minh: 3/5 tasks · 2 waiting for approval' });
    expect(byToken['tok-vi']).toMatchObject({ title: 'Tổng kết hôm nay', body: 'Minh: 3/5 việc · 2 mục chờ duyệt' });
  });
  it('récap : rien à dire → aucun message, quelle que soit la langue', () => {
    for (const locale of LOCALES) expect(recapText([{ name: 'Minh', done: 0, total: 0 }], { tasks: 0, requests: 0 }, locale)).toBeNull();
    expect(buildRecapMessages([parent], devices, [], { tasks: 0, requests: 0 })).toEqual([]);
  });
});

describe('Web Push : le texte suit la langue de l’abonnement', () => {
  const sub = (id: string) => ({ endpoint: `https://push.example/${id}`, keys: { p256dh: 'k', auth: 'a' } });
  const web: DeviceInfo[] = [
    { member_id: 'p1', expo_push_token: null, web_push_subscription: sub('fr'), locale: 'fr' },
    { member_id: 'p1', expo_push_token: null, web_push_subscription: sub('en'), locale: 'en' },
    { member_id: 'p1', expo_push_token: null, web_push_subscription: sub('none') },
  ];
  it('notification d’activité', () => {
    const out = buildWebMessages(act('goal_achieved'), members, web, 'Minh');
    const byEndpoint = Object.fromEntries(out.map((m) => [m.subscription.endpoint.split('/').pop(), m.payload.body]));
    expect(byEndpoint).toEqual({
      fr: 'Minh a atteint son objectif : Toán',
      en: 'Minh reached a goal: Toán',
      none: 'Minh đã đạt mục tiêu: Toán',
    });
    expect(new Set(out.map((m) => m.payload.url))).toEqual(new Set(['/more/goals']));
  });
  it('récap du soir', () => {
    const out = buildWebRecapMessages([parent], web, [{ name: 'Minh', done: 1, total: 2 }]);
    expect(out.map((m) => m.payload.title)).toEqual(["Bilan d'aujourd'hui", "Today's summary", 'Tổng kết hôm nay']);
    expect(buildWebRecapMessages([parent], web, [], { tasks: 0, requests: 0 })).toEqual([]);
  });
});
