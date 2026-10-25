import {
  buildReminderWebMessages,
  dueReminders,
  localParts,
  recapDue,
  recapSettings,
  reminderMinutes,
  reminderText,
  zonedInstant,
  type DeviceInfo,
  type ReminderTask,
} from '../../../supabase/functions/send-push/logic';

const VN = 'Asia/Ho_Chi_Minh';
const task = (over: Partial<ReminderTask> = {}): ReminderTask => ({ id: 't1', child_id: 'c-minh', title: 'Học bài', date: '2026-10-25', time_kind: 'range', start_time: '17:00:00', end_time: '17:30:00', ...over });
const at = (iso: string) => new Date(iso);

describe('jour et heure LOCAUX de la famille (D-099)', () => {
  it('Hô Chi Minh = UTC+7 : le jour local peut être « demain » par rapport à l’UTC', () => {
    expect(localParts(at('2026-10-24T18:00:00Z'), VN)).toEqual({ date: '2026-10-25', minutes: 1 * 60 });
    expect(localParts(at('2026-10-25T13:30:00Z'), VN)).toEqual({ date: '2026-10-25', minutes: 20 * 60 + 30 });
  });
  it('un instant se calcule dans le fuseau, heure d’été comprise', () => {
    expect(zonedInstant('2026-10-25', '17:00:00', VN).toISOString()).toBe('2026-10-25T10:00:00.000Z');
    // Paris : UTC+2 en été, UTC+1 après le 25 octobre 2026 (03:00 → 02:00)
    expect(zonedInstant('2026-10-24', '20:30', 'Europe/Paris').toISOString()).toBe('2026-10-24T18:30:00.000Z');
    expect(zonedInstant('2026-10-26', '20:30', 'Europe/Paris').toISOString()).toBe('2026-10-26T19:30:00.000Z');
  });
  it('fuseau inconnu : lève (l’appelant ignore la famille)', () => {
    expect(() => localParts(new Date(), 'Nowhere/Land')).toThrow();
  });
});

describe('récap du soir : fenêtre d’un passage', () => {
  it('valeurs par défaut : activé à 20:30', () => {
    expect(recapSettings(null)).toEqual({ enabled: true, time: '20:30' });
    expect(recapSettings({ eveningRecap: { enabled: false, time: '19:00' } })).toEqual({ enabled: false, time: '19:00' });
    expect(recapSettings({ eveningRecap: { time: 'abc' } }).time).toBe('20:30');
  });
  it('part au premier passage à partir de l’heure choisie, une seule fois', () => {
    const due = (h: number, m: number) => recapDue(null, h * 60 + m);
    expect(due(20, 15)).toBe(false);
    expect(due(20, 30)).toBe(true);
    expect(due(20, 44)).toBe(true);
    expect(due(20, 45)).toBe(false);
    expect(recapDue({ eveningRecap: { enabled: true, time: '20:40' } }, 20 * 60 + 45)).toBe(true); // 20:45 = premier passage après 20:40
    expect(recapDue({ eveningRecap: { enabled: true, time: '20:40' } }, 20 * 60 + 30)).toBe(false);
  });
  it('désactivé par le parent : jamais', () => {
    expect(recapDue({ eveningRecap: { enabled: false, time: '20:30' } }, 20 * 60 + 30)).toBe(false);
  });
});

describe('rappels des tâches de l’enfant', () => {
  const noon = (h: number, m: number) => at(`2026-10-25T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`); // 10:00Z = 17:00 locales

  it('minutes par défaut 10 (début) et 30 (échéance) ; null, 0 ou valeur invalide', () => {
    expect(reminderMinutes(null, 'start')).toBe(10);
    expect(reminderMinutes(null, 'deadline')).toBe(30);
    expect(reminderMinutes({ reminderBeforeStartMin: 15 }, 'start')).toBe(15);
    expect(reminderMinutes({ reminderBeforeStartMin: null }, 'start')).toBeNull();
    expect(reminderMinutes({ reminderBeforeStartMin: 0 }, 'start')).toBeNull();
    expect(reminderMinutes({ reminderBeforeStartMin: 999 }, 'start')).toBe(10);
    expect(reminderMinutes({ reminderBeforeStartMin: 'x' }, 'start')).toBe(10);
  });

  it('tâche à 17:00 locales, rappel 10 min avant : part au passage qui contient 16:50', () => {
    const t = [task()];
    expect(dueReminders(t, null, noon(9, 49), VN)).toEqual([]); // 16:49
    expect(dueReminders(t, null, noon(9, 50), VN)).toMatchObject([{ taskId: 't1', kind: 'start', minutes: 10, time: '17:00' }]);
    expect(dueReminders(t, null, noon(9, 54), VN)).toMatchObject([{ minutes: 6 }]); // passage en retard : le temps RÉEL restant
    expect(dueReminders(t, null, noon(9, 55), VN)).toEqual([]); // hors fenêtre : le passage suivant n’envoie pas de doublon
  });

  it('jamais après l’heure visée', () => {
    expect(dueReminders([task()], { reminderBeforeStartMin: 3 }, noon(10, 0), VN)).toEqual([]);
  });

  it('échéance « avant 17:30 » : 30 min avant par défaut', () => {
    const t = [task({ time_kind: 'deadline', start_time: null, end_time: '17:30:00' })];
    expect(dueReminders(t, null, noon(10, 0), VN)).toMatchObject([{ kind: 'deadline', minutes: 30, time: '17:30' }]);
  });

  it('préférence désactivée ou tâche sans heure : aucun rappel', () => {
    expect(dueReminders([task()], { reminderBeforeStartMin: null }, noon(9, 50), VN)).toEqual([]);
    expect(dueReminders([task({ time_kind: 'anytime', start_time: null, end_time: null })], null, noon(9, 50), VN)).toEqual([]);
  });

  it('le jour de la tâche est un jour LOCAL : 00:05 locales du 26 = 17:05Z du 25', () => {
    const t = [task({ date: '2026-10-26', start_time: '00:15:00', end_time: '00:45:00' })];
    expect(dueReminders(t, null, at('2026-10-25T17:05:00Z'), VN)).toMatchObject([{ minutes: 10 }]);
  });

  it('texte dans la langue de l’appareil (vietnamien par défaut)', () => {
    const [r] = dueReminders([task()], null, noon(9, 50), VN);
    expect(reminderText(r!)).toEqual({ title: 'Học bài', body: 'Bắt đầu lúc 17:00 (còn 10 phút)' });
    expect(reminderText(r!, 'fr').body).toBe('Début à 17:00 (dans 10 min)');
    expect(reminderText(r!, 'en').body).toBe('Starts at 17:00 (in 10 min)');
  });
});

describe('destinataires des rappels', () => {
  const sub = (endpoint: string) => ({ endpoint, keys: { p256dh: 'k', auth: 'a' } });
  const devices: DeviceInfo[] = [
    { member_id: 'm-minh', expo_push_token: null, web_push_subscription: sub('https://push/minh'), locale: 'fr' },
    { member_id: 'm-minh', expo_push_token: 'ExpoPushToken[minh]', web_push_subscription: null }, // natif : a ses rappels locaux
    { member_id: 'm-khang', expo_push_token: null, web_push_subscription: sub('https://push/khang') },
    { member_id: 'p1', expo_push_token: null, web_push_subscription: sub('https://push/parent') },
  ];
  const [due] = dueReminders([task()], null, new Date('2026-10-25T09:50:00Z'), VN);

  it('seulement les NAVIGATEURS de l’enfant concerné (ni natif, ni frère, ni parent)', () => {
    const out = buildReminderWebMessages([due!], 'm-minh', devices);
    expect(out).toHaveLength(1);
    expect(out[0]!.subscription.endpoint).toBe('https://push/minh');
    expect(out[0]!.payload).toMatchObject({ title: 'Học bài', body: 'Début à 17:00 (dans 10 min)', url: '/', tag: 'reminder-t1-start', data: { type: 'reminder_start', taskId: 't1' } });
  });
  it('aucun appareil web : rien', () => {
    expect(buildReminderWebMessages([due!], 'm-nobody', devices)).toEqual([]);
  });
});
