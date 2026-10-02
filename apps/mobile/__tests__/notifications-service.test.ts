import '@/i18n';
import { DEFAULT_PREFS } from '@/domain/notification-prefs';
import { planReminders, type ReminderTask } from '@/domain/reminders';
import { handleNotificationResponse, syncLocalReminders } from '@/services/notifications';

const mockScheduled: { identifier: string }[] = [];
const mockSchedule = jest.fn();
const mockCancel = jest.fn();
jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date' },
  AndroidImportance: { DEFAULT: 3 },
  getAllScheduledNotificationsAsync: jest.fn(async () => mockScheduled),
  scheduleNotificationAsync: (...a: unknown[]) => mockSchedule(...a),
  cancelScheduledNotificationAsync: (...a: unknown[]) => mockCancel(...a),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  setNotificationCategoryAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}));
jest.mock('@/api/notifications', () => ({ registerDevice: jest.fn() }));
jest.mock('@/api/points', () => ({ approveRewardRequest: jest.fn(), rejectRewardRequest: jest.fn() }));

const HCM = 'Asia/Ho_Chi_Minh';
const task = (over: Partial<ReminderTask>): ReminderTask => ({
  id: 't1', title: 'Làm bài tập Toán', date: '2026-07-02', time_kind: 'range', start_time: '20:00:00', end_time: '21:00:00', completed_at: null, deleted_at: null, ...over,
});
const planFor = (tasks: ReminderTask[]) =>
  planReminders({ tasks, prefs: { ...DEFAULT_PREFS, eveningRecap: { enabled: false, time: '20:30' } }, now: new Date('2026-07-02T03:00:00Z'), timeZone: HCM, today: '2026-07-02' });

describe('syncLocalReminders', () => {
  beforeEach(() => { jest.clearAllMocks(); mockScheduled.length = 0; });

  it('une tâche créée par le parent pour 20:00 déclenche un rappel local à 19:50 sur le téléphone de l’enfant (§8)', async () => {
    await syncLocalReminders(planFor([task({})]));
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    const arg = mockSchedule.mock.calls[0]?.[0] as { identifier: string; content: { title: string; body: string }; trigger: { type: string; date: Date } };
    expect(arg.identifier).toBe('task:t1:start');
    expect(arg.content.title).toBe('Làm bài tập Toán');
    expect(arg.content.body).toBe('Bắt đầu lúc 20:00 (còn 10 phút)');
    expect(arg.trigger.type).toBe('date');
    expect(arg.trigger.date.toISOString()).toBe('2026-07-02T12:50:00.000Z'); // 19:50 heure famille
  });

  it('replanifie à la synchro : annule les rappels devenus inutiles (tâche cochée ou supprimée), sans doublon', async () => {
    mockScheduled.push({ identifier: 'task:t1:start' }, { identifier: 'task:gone:start' }, { identifier: 'autre-app' });
    await syncLocalReminders(planFor([task({})]));
    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockCancel).toHaveBeenCalledWith('task:gone:start');
    expect(mockSchedule).toHaveBeenCalledTimes(1); // même identifiant → remplace, pas de doublon
  });

  it('tâche cochée entre-temps : plus rien de planifié, l’ancien rappel est annulé', async () => {
    mockScheduled.push({ identifier: 'task:t1:start' });
    await syncLocalReminders(planFor([task({ completed_at: '2026-07-02T05:00:00Z' })]));
    expect(mockCancel).toHaveBeenCalledWith('task:t1:start');
    expect(mockSchedule).not.toHaveBeenCalled();
  });
});

describe('handleNotificationResponse (boutons de la demande d’échange)', () => {
  const response = (actionIdentifier: string, data: object) => ({ actionIdentifier, notification: { request: { content: { data } } } });
  const deps = () => ({ approve: jest.fn().mockResolvedValue(undefined), reject: jest.fn().mockResolvedValue(undefined), navigate: jest.fn() });

  it('Approuver appelle la RPC d’approbation, sans ouvrir l’app', async () => {
    const d = deps();
    await handleNotificationResponse(response('approve', { type: 'reward_requested', requestId: 'r1' }), d);
    expect(d.approve).toHaveBeenCalledWith('r1');
    expect(d.reject).not.toHaveBeenCalled();
    expect(d.navigate).not.toHaveBeenCalled();
  });
  it('Refuser appelle la RPC de refus', async () => {
    const d = deps();
    await handleNotificationResponse(response('reject', { type: 'reward_requested', requestId: 'r1' }), d);
    expect(d.reject).toHaveBeenCalledWith('r1');
  });
  it('un tap simple navigue vers l’écran des points', async () => {
    const d = deps();
    await handleNotificationResponse(response('default', { type: 'reward_requested', requestId: 'r1' }), d);
    expect(d.navigate).toHaveBeenCalledWith('/more/points');
    expect(d.approve).not.toHaveBeenCalled();
  });
});
