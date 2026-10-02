import {
  buildMessages,
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
