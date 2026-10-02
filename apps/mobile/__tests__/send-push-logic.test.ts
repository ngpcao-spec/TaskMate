import {
  GROUP_WINDOW_MS,
  buildMessages,
  countGroupedCompletions,
  buildRecapMessages,
  chunk,
  recipientsFor,
  textFor,
  tokensToRemove,
  type ActivityRecord,
  type DeviceInfo,
  type MemberInfo,
} from '../../../supabase/functions/send-push/logic';

const parent1: MemberInfo = { id: 'p1', role: 'parent', child_id: null, display_name: 'Ba', prefs: null };
const parent2: MemberInfo = { id: 'p2', role: 'parent', child_id: null, display_name: 'Mẹ', prefs: { activity: { taskDone: false } } };
const minh: MemberInfo = { id: 'm-minh', role: 'child', child_id: 'c-minh', display_name: 'Minh', prefs: null };
const khang: MemberInfo = { id: 'm-khang', role: 'child', child_id: 'c-khang', display_name: 'Khang', prefs: null };
const members = [parent1, parent2, minh, khang];
const devices: DeviceInfo[] = [
  { member_id: 'p1', expo_push_token: 'ExpoPushToken[p1]' },
  { member_id: 'p2', expo_push_token: 'ExpoPushToken[p2]' },
  { member_id: 'm-minh', expo_push_token: 'ExpoPushToken[minh]' },
  { member_id: 'm-khang', expo_push_token: 'ExpoPushToken[khang]' },
  { member_id: 'p1', expo_push_token: null },
];
const act = (type: string, over: Partial<ActivityRecord> = {}): ActivityRecord => ({
  id: 'a1', family_id: 'f1', child_id: 'c-minh', actor_member_id: 'm-minh', type, payload: { title: 'Chơi game 1 tiếng', cost: 100, request_id: 'r1' }, ...over,
});
const ids = (ms: MemberInfo[]) => ms.map((m) => m.id);

describe('recipientsFor', () => {
  it('demande d’échange : tous les parents (activée par défaut)', () => {
    expect(ids(recipientsFor(act('reward_requested'), members))).toEqual(['p1', 'p2']);
  });
  it('respecte les préférences : tâche faite coupée chez le parent 2', () => {
    expect(ids(recipientsFor(act('task_completed'), members))).toEqual(['p1']);
  });
  it('objectif atteint : parents ; jamais l’enfant ni son frère', () => {
    expect(ids(recipientsFor(act('goal_achieved'), members))).toEqual(['p1', 'p2']);
  });
  it('tâche cochée à valider : tous les parents (préférence « Tâches cochées » respectée)', () => {
    expect(ids(recipientsFor(act('task_completed'), members))).toEqual(['p1']); // p2 a coupé taskDone
  });
  it('validée / refusée : SEUL l’enfant concerné, jamais son frère', () => {
    for (const type of ['task_validated', 'task_rejected']) {
      expect(ids(recipientsFor(act(type, { actor_member_id: 'p1' }), members))).toEqual(['m-minh']);
    }
  });
  it('décision parent → SEUL l’enfant concerné, jamais son frère (§5.6)', () => {
    for (const type of ['reward_approved', 'reward_rejected', 'reward_expired', 'points_adjusted', 'task_assigned']) {
      const r = ids(recipientsFor(act(type, { actor_member_id: 'p1' }), members));
      expect(r).toEqual(['m-minh']);
      expect(r).not.toContain('m-khang');
    }
  });
  it('aucune notification à l’enfant à propos de l’activité de son frère', () => {
    const khangDone = act('task_completed', { child_id: 'c-khang', actor_member_id: 'm-khang' });
    expect(ids(recipientsFor(khangDone, members)).some((id) => id.startsWith('m-'))).toBe(false);
  });
  it('n’envoie pas à l’acteur lui-même ; type inconnu → personne', () => {
    expect(ids(recipientsFor(act('task_completed', { actor_member_id: 'p1' }), members))).toEqual([]);
    expect(recipientsFor(act('weird'), members)).toEqual([]);
  });
});

describe('buildMessages', () => {
  it('demande d’échange : catégorie Approuver/Refuser + requestId, un message par appareil valide', () => {
    const msgs = buildMessages(act('reward_requested'), members, devices, 'Minh');
    expect(msgs.map((m) => m.to)).toEqual(['ExpoPushToken[p1]', 'ExpoPushToken[p2]']); // le jeton null est ignoré
    expect(msgs[0]).toMatchObject({ categoryId: 'reward_request', data: { type: 'reward_requested', requestId: 'r1', childId: 'c-minh' }, body: 'Minh muốn đổi: Chơi game 1 tiếng (100 điểm)' });
  });
  it('approuvée : « Đã được duyệt 🎉 » vers l’enfant uniquement, sans catégorie', () => {
    const msgs = buildMessages(act('reward_approved', { actor_member_id: 'p1' }), members, devices, 'Minh');
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatchObject({ to: 'ExpoPushToken[minh]', body: 'Đã được duyệt 🎉 Chơi game 1 tiếng' });
    expect(msgs[0]?.categoryId).toBeUndefined();
  });
  it('refusée : le motif optionnel est ajouté', () => {
    expect(textFor(act('reward_rejected', { payload: { title: 'Phim', note: 'pas ce soir' } }), 'Minh')?.body).toBe('Yêu cầu bị từ chối: Phim — pas ce soir');
  });
  it('type inconnu : aucun message', () => {
    expect(buildMessages(act('weird'), members, devices, 'Minh')).toEqual([]);
  });
});

describe('récap du soir, jetons invalides, découpage', () => {
  it('récap parents : une ligne par enfant ayant des tâches', () => {
    const msgs = buildRecapMessages([parent1], devices, [{ name: 'Minh', done: 3, total: 5 }, { name: 'Khang', done: 0, total: 0 }]);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.body).toBe('Minh: 3/5 việc');
    expect(buildRecapMessages([parent1], devices, [{ name: 'Minh', done: 0, total: 0 }])).toEqual([]);
  });
  it('nettoie les jetons « DeviceNotRegistered » reçus dans les tickets Expo', () => {
    const msgs = buildMessages(act('reward_requested'), members, devices, 'Minh');
    expect(tokensToRemove(msgs, [{ status: 'ok', id: 't1' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }])).toEqual(['ExpoPushToken[p2]']);
    expect(tokensToRemove(msgs, [{ status: 'error', details: { error: 'MessageRateExceeded' } }])).toEqual([]);
  });
  it('découpe en lots de 100 (limite Expo)', () => {
    expect(chunk(Array.from({ length: 250 }, (_, i) => i), 100).map((c) => c.length)).toEqual([100, 100, 50]);
  });
});

describe('tâches à valider (SPEC v4 §5.6)', () => {
  const done = act('task_completed', { payload: { title: 'Học Toán', task_id: 't1', points: 10 } });

  it('une coche : message « chờ duyệt » avec boutons Duyệt / Từ chối et taskId', () => {
    const msgs = buildMessages(done, members, devices, 'Minh');
    expect(msgs.map((m) => m.to)).toEqual(['ExpoPushToken[p1]']);
    expect(msgs[0]).toMatchObject({ body: 'Minh đã hoàn thành: Học Toán — chờ duyệt', categoryId: 'task_validation', data: { taskId: 't1', type: 'task_completed' }, collapseId: 'tasks-c-minh' });
  });
  it('plusieurs coches en < 10 min : « Minh đã hoàn thành 3 việc », sans boutons (ouvre la file)', () => {
    const msgs = buildMessages(done, members, devices, 'Minh', 3);
    expect(msgs[0]?.body).toBe('Minh đã hoàn thành 3 việc — chờ duyệt');
    expect(msgs[0]?.categoryId).toBeUndefined();
    expect(msgs[0]?.data).not.toHaveProperty('taskId');
    expect(msgs[0]?.collapseId).toBe('tasks-c-minh'); // remplace la notification précédente
  });
  it('regroupement : compte les coches de la fenêtre de 10 minutes', () => {
    const at = '2026-07-02T10:00:00Z';
    const recent = [{ created_at: '2026-07-02T09:55:00Z' }, { created_at: '2026-07-02T09:58:00Z' }, { created_at: at }, { created_at: '2026-07-02T09:40:00Z' }];
    expect(countGroupedCompletions({ ...done, created_at: at } as never, recent)).toBe(3);
    expect(GROUP_WINDOW_MS).toBe(600000);
    expect(countGroupedCompletions({ ...done, created_at: at } as never, [])).toBe(1);
  });
  it('validée : « +10 điểm » pour l’enfant ; refusée : avec le motif', () => {
    const v = buildMessages(act('task_validated', { actor_member_id: 'p1', payload: { title: 'Học Toán', points: 10 } }), members, devices, 'Minh');
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ to: 'ExpoPushToken[minh]', body: 'Đã được duyệt 🎉 Học Toán (+10 điểm)' });
    const r = buildMessages(act('task_rejected', { actor_member_id: 'p1', payload: { title: 'Học Toán', note: 'làm lại' } }), members, devices, 'Minh');
    expect(r[0]).toMatchObject({ to: 'ExpoPushToken[minh]', body: 'Việc bị từ chối: Học Toán — làm lại' });
  });
  it('récap du soir : ajoute le nombre d’éléments en attente, même sans tâche du jour', () => {
    const withPending = buildRecapMessages([parent1], devices, [{ name: 'Minh', done: 3, total: 5 }], { tasks: 2, requests: 1 });
    expect(withPending[0]?.body).toBe('Minh: 3/5 việc · 3 mục chờ duyệt');
    expect(buildRecapMessages([parent1], devices, [{ name: 'Minh', done: 0, total: 0 }], { tasks: 1, requests: 0 })[0]?.body).toBe('1 mục chờ duyệt');
    expect(buildRecapMessages([parent1], devices, [{ name: 'Minh', done: 0, total: 0 }])).toEqual([]);
  });
});
