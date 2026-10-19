import {
  buildMessages,
  buildRecapMessages,
  buildTestMessages,
  buildWebMessages,
  buildWebRecapMessages,
  countGroupedCompletions,
  expoResultLabel,
  explainDelivery,
  recapText,
  recipientsFor,
  subjectLabel,
  textFor,
  urlForType,
  webResultLabel,
  type ActivityRecord,
  type DeviceInfo,
  type MemberInfo,
} from '../../../supabase/functions/send-push/logic';

// D-088 : notifications des quiz « Ôn tập » (quiz_submitted → parents, quiz_validated → l'enfant concerné).
const ba: MemberInfo = { id: 'p-ba', role: 'parent', child_id: null, display_name: 'Ba', prefs: null };
const me: MemberInfo = { id: 'p-me', role: 'parent', child_id: null, display_name: 'Mẹ', prefs: null };
const tien: MemberInfo = { id: 'm-tien', role: 'child', child_id: 'c-tien', display_name: 'Tien', prefs: null };
const tuan: MemberInfo = { id: 'm-tuan', role: 'child', child_id: 'c-tuan', display_name: 'Tuan', prefs: null };
const family = [ba, me, tien, tuan];
const SUB = (over: Record<string, unknown> = {}, rest: Partial<ActivityRecord> = {}): ActivityRecord => ({
  id: 'a1', family_id: 'f1', child_id: 'c-tien', actor_member_id: 'm-tien', type: 'quiz_submitted', payload: { attempt_id: 'att1', title: 'Bài 1', subject: 'hist_geo', ...over }, ...rest,
});
const VAL = (over: Record<string, unknown> = {}): ActivityRecord =>
  SUB({ score: 14, total: 16, points: 8, show_correction: false, ...over }, { type: 'quiz_validated', actor_member_id: 'p-ba' });
const web = (member: string, endpoint: string, locale = 'vi'): DeviceInfo => ({ member_id: member, expo_push_token: null, locale, web_push_subscription: { endpoint, keys: { p256dh: 'k', auth: 'a' } } });
const expo = (member: string, token: string, locale = 'vi'): DeviceInfo => ({ member_id: member, expo_push_token: token, locale });

describe('destinataires', () => {
  it('quiz_submitted : TOUS les parents de la famille (jamais l’enfant, ni son frère)', () => {
    expect(recipientsFor(SUB(), family).map((m) => m.id)).toEqual(['p-ba', 'p-me']);
  });
  it('quiz_submitted : un parent qui a coupé « quizSubmitted » ne reçoit rien ; clé absente = activé', () => {
    const off = { ...ba, prefs: { activity: { quizSubmitted: false } } };
    const oldPrefs = { ...me, prefs: { activity: { taskDone: false } } }; // anciennes préférences sans la clé
    expect(recipientsFor(SUB(), [off, oldPrefs, tien]).map((m) => m.id)).toEqual(['p-me']);
  });
  it('quiz_validated : l’enfant concerné SEULEMENT (jamais son frère, jamais un parent)', () => {
    expect(recipientsFor(VAL(), family).map((m) => m.id)).toEqual(['m-tien']);
    expect(recipientsFor(VAL({}), [tuan, ba])).toEqual([]);
  });
  it('quiz_validated : l’enfant peut couper « quizValidated » ; clé absente = activé ; les autres préférences ne coupent rien', () => {
    expect(recipientsFor(VAL(), [{ ...tien, prefs: { activity: { quizValidated: false } } }])).toEqual([]);
    expect(recipientsFor(VAL(), [{ ...tien, prefs: { activity: {} } }]).map((m) => m.id)).toEqual(['m-tien']);
    expect(recipientsFor(VAL(), [{ ...tien, prefs: { activity: { taskDone: false } } }]).map((m) => m.id)).toEqual(['m-tien']);
  });
  it('l’acteur ne reçoit jamais sa propre notification', () => {
    expect(recipientsFor(VAL(), [{ ...tien }, ba]).map((m) => m.id)).toEqual(['m-tien']);
    expect(recipientsFor({ ...VAL(), actor_member_id: 'm-tien' }, [tien])).toEqual([]);
  });
});

describe('pourquoi rien ne part (skipped)', () => {
  const devs = [web('p-ba', 'https://p/ba')];
  it('aucun destinataire possible (l’acteur est le seul parent, ou activité inconnue)', () => {
    expect(explainDelivery({ ...SUB(), actor_member_id: 'p-ba' }, [ba], devs).skipped).toEqual({ noRecipient: 1, prefOff: 0, noDevice: 0 });
    expect(explainDelivery({ ...SUB(), type: 'inconnu' }, family, devs).skipped.noRecipient).toBe(1);
  });
  it('préférence coupée', () => {
    expect(explainDelivery(SUB(), [{ ...ba, prefs: { activity: { quizSubmitted: false } } }], devs).skipped).toEqual({ noRecipient: 0, prefOff: 1, noDevice: 0 });
  });
  it('destinataire sans appareil', () => {
    expect(explainDelivery(SUB(), [ba, me], devs).skipped).toEqual({ noRecipient: 0, prefOff: 0, noDevice: 1 });
    expect(explainDelivery(SUB(), [ba], []).skipped.noDevice).toBe(1);
  });
  it('tout est bon : zéro partout ; un appareil mobile compte aussi', () => {
    expect(explainDelivery(SUB(), [ba, me], [web('p-ba', 'https://p/ba'), expo('p-me', 'ExponentPushToken[x]')]).skipped).toEqual({ noRecipient: 0, prefOff: 0, noDevice: 0 });
  });
});

describe('textes dans les trois langues', () => {
  it('quiz_submitted : « {Prénom} a terminé … — à valider », matière traduite par langue', () => {
    expect(textFor(SUB(), 'Tien', 1, 'vi')?.body).toBe('Tien đã làm xong bài ôn tập Lịch sử và Địa lý — cần duyệt');
    expect(textFor(SUB(), 'Tien', 1, 'fr')?.body).toBe('Tien a terminé le quiz « Histoire-Géographie » — à valider');
    expect(textFor(SUB(), 'Tien', 1, 'en')?.body).toBe('Tien finished the History & Geography quiz — waiting for approval');
    expect(textFor(SUB(), 'Tien')?.body).toContain('cần duyệt'); // vietnamien par défaut
  });
  it('matière libre (jeu de la famille) telle quelle ; sans matière : le titre du quiz', () => {
    expect(textFor(SUB({ subject: 'Toán lớp 5' }), 'Tien', 1, 'vi')?.body).toBe('Tien đã làm xong bài ôn tập Toán lớp 5 — cần duyệt');
    expect(textFor(SUB({ subject: '' }), 'Tien', 1, 'fr')?.body).toBe('Tien a terminé le quiz « Bài 1 » — à valider');
    expect(subjectLabel('fr', 'maths')).toBe('Mathématiques');
    expect(subjectLabel('en', 'zzz')).toBe('zzz');
  });
  it('plusieurs quiz d’affilée : une seule notification groupée', () => {
    expect(textFor(SUB(), 'Tien', 3, 'vi')?.body).toBe('Tien đã làm xong 3 bài ôn tập — cần duyệt');
    expect(textFor(SUB(), 'Tien', 3, 'fr')?.body).toBe('Tien a terminé 3 quiz — à valider');
    expect(textFor(SUB(), 'Tien', 3, 'en')?.body).toBe('Tien finished 3 quizzes — waiting for approval');
  });
  it('quiz_validated : avec points, et variante sans points (0)', () => {
    expect(textFor(VAL(), 'Tien', 1, 'vi')?.body).toBe('Bài ôn tập đã được duyệt · +8 điểm');
    expect(textFor(VAL(), 'Tien', 1, 'fr')?.body).toBe('Quiz validé · +8 points');
    expect(textFor(VAL(), 'Tien', 1, 'en')?.body).toBe('Review approved · +8 points');
    expect(textFor(VAL({ points: 0 }), 'Tien', 1, 'vi')?.body).toBe('Bài ôn tập đã được duyệt');
    expect(textFor(VAL({ points: 0 }), 'Tien', 1, 'fr')?.body).toBe('Quiz validé');
    expect(textFor(VAL({ points: 0 }), 'Tien', 1, 'en')?.body).toBe('Review approved');
    expect(textFor(VAL({ points: undefined }), 'Tien', 1, 'en')?.body).toBe('Review approved');
  });
});

describe('messages mobiles et web', () => {
  const devices = [expo('p-ba', 'ExponentPushToken[ba]', 'fr'), web('p-me', 'https://p/me', 'en'), expo('m-tien', 'ExponentPushToken[tien]', 'vi'), expo('m-tuan', 'ExponentPushToken[tuan]')];
  it('quiz_submitted : à chaque parent dans la langue de SON appareil, regroupés par enfant', () => {
    const msgs = buildMessages(SUB(), family, devices, 'Tien');
    expect(msgs.map((m) => m.to)).toEqual(['ExponentPushToken[ba]']);
    expect(msgs[0]?.body).toBe('Tien a terminé le quiz « Histoire-Géographie » — à valider');
    expect(msgs[0]?.collapseId).toBe('quizzes-c-tien');
    expect(msgs[0]?.data).toMatchObject({ type: 'quiz_submitted', childId: 'c-tien' });
    const w = buildWebMessages(SUB(), family, devices, 'Tien');
    expect(w).toHaveLength(1);
    expect(w[0]?.payload).toMatchObject({ body: 'Tien finished the History & Geography quiz — waiting for approval', tag: 'quizzes-c-tien', url: '/weekly?child=c-tien' });
  });
  it('quiz_validated : seulement l’appareil de l’enfant concerné, jamais celui de son frère', () => {
    const msgs = buildMessages(VAL(), family, devices, 'Tien');
    expect(msgs.map((m) => m.to)).toEqual(['ExponentPushToken[tien]']);
    expect(msgs[0]?.body).toBe('Bài ôn tập đã được duyệt · +8 điểm');
    expect(msgs[0]?.collapseId).toBeUndefined();
    expect(buildWebMessages(VAL(), family, [web('m-tien', 'https://p/tien'), web('m-tuan', 'https://p/tuan')], 'Tien').map((m) => m.subscription.endpoint)).toEqual(['https://p/tien']);
    expect(buildWebMessages(VAL(), family, [web('m-tien', 'https://p/tien')], 'Tien')[0]?.payload.url).toBe('/weekly');
  });
  it('D-089 : le lien d’un quiz terminé ouvre le DÉTAIL de ce quiz pour cet enfant (repli sur Ôn tập sans identifiant de quiz)', () => {
    const withQuiz = SUB({ quiz_id: 'q 1', attempt_id: 'att/1' });
    expect(buildWebMessages(withQuiz, family, devices, 'Tien')[0]?.payload.url).toBe('/quiz/detail?child=c-tien&quiz=q%201&attempt=att%2F1');
    expect(buildMessages(withQuiz, family, devices, 'Tien')[0]?.data).toMatchObject({ type: 'quiz_submitted', childId: 'c-tien', quizId: 'q 1', attemptId: 'att/1' });
    expect(urlForType('quiz_submitted', 'c-tien', { quiz_id: 'q1' })).toBe('/quiz/detail?child=c-tien&quiz=q1');
    expect(urlForType('quiz_submitted', null, { quiz_id: 'q1' })).toBe('/weekly');
    expect(urlForType('quiz_submitted', 'c-tien', { quiz_id: 42 })).toBe('/weekly?child=c-tien');
    expect(buildWebMessages(SUB(), family, devices, 'Tien')[0]?.payload.url).toBe('/weekly?child=c-tien');
    // l'enfant ne reçoit jamais ce lien : sa notification de validation reste « Ôn tập »
    expect(buildWebMessages(VAL({ quiz_id: 'q1' }), family, [web('m-tien', 'https://p/tien')], 'Tien')[0]?.payload.url).toBe('/weekly');
  });
  it('liens', () => {
    expect(urlForType('quiz_submitted', 'c tien/é')).toBe('/weekly?child=c%20tien%2F%C3%A9');
    expect(urlForType('quiz_submitted')).toBe('/weekly');
    expect(urlForType('quiz_validated', 'c-tien')).toBe('/weekly');
    expect(urlForType('task_completed')).toBe('/approvals');
  });
  it('regroupement sur 10 minutes pour les quiz comme pour les tâches', () => {
    const now = '2026-10-18T10:00:00Z';
    const recent = [{ created_at: '2026-10-18T09:55:00Z' }, { created_at: '2026-10-18T09:58:00Z' }, { created_at: now }, { created_at: '2026-10-18T09:40:00Z' }];
    expect(countGroupedCompletions({ ...SUB(), created_at: now } as ActivityRecord & { created_at: string }, recent)).toBe(3);
    expect(countGroupedCompletions(SUB(), [])).toBe(1);
  });
});

describe('récap du soir : quiz à valider', () => {
  const summary = [{ name: 'Tien', done: 1, total: 2 }];
  it('ajoute les quiz restants dans les trois langues', () => {
    expect(recapText(summary, { tasks: 0, requests: 0, quizzes: 2 }, 'vi')?.body).toBe('Tien: 1/2 việc · 2 bài ôn tập chờ duyệt');
    expect(recapText(summary, { tasks: 1, requests: 0, quizzes: 1 }, 'fr')?.body).toBe('Tien : 1/2 tâches · 1 à valider · 1 quiz à valider');
    expect(recapText(summary, { tasks: 0, requests: 0, quizzes: 3 }, 'en')?.body).toBe('Tien: 1/2 tasks · 3 quizzes waiting for approval');
  });
  it('sans quiz (ancien appel) : inchangé ; seulement des quiz : le récap part quand même', () => {
    expect(recapText(summary, { tasks: 0, requests: 0 }, 'en')?.body).toBe('Tien: 1/2 tasks');
    expect(recapText([], { tasks: 0, requests: 0, quizzes: 1 }, 'fr')?.body).toBe('1 quiz à valider');
    expect(recapText([], { tasks: 0, requests: 0, quizzes: 0 }, 'fr')).toBeNull();
  });
  it('messages mobiles et web : lien vers la validation', () => {
    const devs = [expo('p-ba', 'ExponentPushToken[ba]'), web('p-me', 'https://p/me')];
    expect(buildRecapMessages([ba], devs, [], { tasks: 0, requests: 0, quizzes: 1 })[0]?.body).toBe('1 bài ôn tập chờ duyệt');
    expect(buildWebRecapMessages([me], devs, [], { tasks: 0, requests: 0, quizzes: 1 })[0]?.payload.url).toBe('/weekly');
    expect(buildWebRecapMessages([me], devs, [], { tasks: 1, requests: 0, quizzes: 1 })[0]?.payload.url).toBe('/approvals');
  });
});

describe('diagnostic d’envoi', () => {
  it('résultat mémorisé par appareil', () => {
    expect(webResultLabel()).toBe('sent');
    expect(webResultLabel(404)).toBe('gone');
    expect(webResultLabel(410)).toBe('gone');
    expect(webResultLabel(403)).toBe('failed:403');
    expect(webResultLabel(0)).toBe('failed:0');
    expect(expoResultLabel({ status: 'ok', id: 'x' })).toBe('sent');
    expect(expoResultLabel({ status: 'error', details: { error: 'DeviceNotRegistered' } })).toBe('error:DeviceNotRegistered');
    expect(expoResultLabel({ status: 'error' })).toBe('error:unknown');
    expect(expoResultLabel(undefined)).toBe('error:no_ticket');
  });
  it('notification de test : SES appareils seulement, un navigateur précis si demandé, langue de l’appareil', () => {
    const devs = [web('p-ba', 'https://p/a', 'fr'), web('p-ba', 'https://p/b', 'en'), expo('p-ba', 'ExponentPushToken[ba]', 'vi'), web('p-me', 'https://p/me')];
    const all = buildTestMessages(devs, 'p-ba');
    expect(all.web.map((m) => m.subscription.endpoint)).toEqual(['https://p/a', 'https://p/b']);
    expect(all.expo.map((m) => m.to)).toEqual(['ExponentPushToken[ba]']);
    expect(all.web[0]?.payload.body).toBe('Notification de test — cet appareil reçoit bien les notifications ✅');
    expect(all.web[1]?.payload.body).toBe('Test notification — this device receives notifications ✅');
    expect(all.expo[0]?.body).toBe('Thông báo thử — thiết bị này nhận được thông báo ✅');
    const one = buildTestMessages(devs, 'p-ba', 'https://p/b');
    expect(one.web.map((m) => m.subscription.endpoint)).toEqual(['https://p/b']);
    expect(one.expo).toEqual([]);
    expect(buildTestMessages(devs, 'inconnu')).toEqual({ expo: [], web: [] });
  });
});
