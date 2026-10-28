import {
  classLabel,
  countriesLabel,
  cronState,
  dayBars,
  dayOf,
  DEFAULT_SORT,
  formatBytes,
  formatDate,
  formatStamp,
  lastPage,
  nextSort,
  parseFamilyDetail,
  parseFamilyPage,
  parseFamilyRow,
  parseHealth,
  parseOverview,
  parseSeries,
  parseUsage,
  shortDay,
  weekBars,
} from './admin-stats';

const counters = { tasks_created: 1, tasks_generated: 2, tasks_completed: 3, tasks_validated: 4, quizzes_submitted: 5, quizzes_validated: 6, reward_requests: 7, ai_calls: 8, ai_failed: 1, avatar_calls: 9, avatar_failed: 2 };
const familyRaw = {
  family_id: 'f1', name: 'Gia đình A', creator_email: 'ba@example.com', countries: ['VN'], parents: 2, children: 1, classes: [{ country: 'VN', grade: '7' }],
  created_at: '2026-10-01T00:00:00Z', last_active_at: null, status: 'dormant', notifications: true,
};

describe('lecture des réponses des RPC d’administration (D-102)', () => {
  it('indicateurs', () => {
    const o = parseOverview({ families: 2, parents: 3, children: 4, new_families_7d: 1, new_families_30d: 2, active: { today: { parents: 1, children: 0 }, d7: { parents: 2, children: 1 }, d30: { parents: 3, children: 2 } }, families_with_notifications: 1 });
    expect(o).toEqual({ families: 2, parents: 3, children: 4, newFamilies7d: 1, newFamilies30d: 2, active: { today: { parents: 1, children: 0 }, d7: { parents: 2, children: 1 }, d30: { parents: 3, children: 2 } }, familiesWithNotifications: 1 });
  });
  it('un nombre arrive parfois en texte (bigint) : accepté ; négatif, décimal ou texte libre : refusé', () => {
    expect(parseOverview({ families: '5', parents: 0, children: 0, new_families_7d: 0, new_families_30d: 0, active: { today: { parents: 0, children: 0 }, d7: { parents: 0, children: 0 }, d30: { parents: 0, children: 0 } }, families_with_notifications: 0 }).families).toBe(5);
    expect(() => parseOverview({ families: -1 })).toThrow('invalid_stats');
    expect(() => parseOverview({ families: 'abc' })).toThrow('invalid_stats');
    expect(() => parseOverview(null)).toThrow('invalid_stats');
    expect(() => parseOverview([])).toThrow('invalid_stats');
  });
  it('séries', () => {
    const s = parseSeries({ weeks: [{ week_start: '2026-10-19', families: 2 }], days: [{ day: '2026-10-28', parents: 1, children: 2 }] });
    expect(s).toEqual({ weeks: [{ weekStart: '2026-10-19', families: 2 }], days: [{ day: '2026-10-28', parents: 1, children: 2 }] });
    expect(() => parseSeries({ weeks: 'x', days: [] })).toThrow('invalid_stats');
  });
  it('usage : compteurs, quiz par classe, appels IA par modèle', () => {
    const u = parseUsage({
      d7: counters, d30: counters,
      quiz_by_class: [{ country: 'VN', grade: '7', subject: 'maths', submitted_7d: 1, validated_7d: 0, submitted_30d: 2, validated_30d: 1 }],
      ai_by_model: [{ kind: 'avatar', model: 'gpt-image-2', calls_7d: 1, calls_30d: 2, failed_30d: 0, input_tokens_30d: 0, output_tokens_30d: 0 }, { kind: 'questions', model: '', calls_7d: 0, calls_30d: 1, failed_30d: 0, input_tokens_30d: 10, output_tokens_30d: 5 }],
    });
    expect(u.d7.tasksCreated).toBe(1);
    expect(u.d30.avatarFailed).toBe(2);
    expect(u.quizByClass[0]).toEqual({ country: 'VN', grade: '7', subject: 'maths', submitted7d: 1, validated7d: 0, submitted30d: 2, validated30d: 1 });
    expect(u.aiByModel.map((m) => m.kind)).toEqual(['avatar', 'questions']);
    expect(() => parseUsage({ d7: counters, d30: counters, quiz_by_class: [], ai_by_model: [{ kind: 'autre', model: 'x', calls_7d: 0, calls_30d: 0, failed_30d: 0, input_tokens_30d: 0, output_tokens_30d: 0 }] })).toThrow('invalid_stats');
  });
  it('famille : ligne, page et fiche', () => {
    const row = parseFamilyRow(familyRaw);
    expect(row).toMatchObject({ familyId: 'f1', creatorEmail: 'ba@example.com', parents: 2, lastActiveAt: null, status: 'dormant', notifications: true });
    expect(parseFamilyRow({ ...familyRaw, creator_email: null, countries: undefined, classes: undefined, notifications: false })).toMatchObject({ creatorEmail: null, countries: [], classes: [], notifications: false });
    expect(parseFamilyRow({ ...familyRaw, classes: [{ country: null, grade: null }] }).classes).toEqual([{ country: null, grade: null }]);
    expect(() => parseFamilyRow({ ...familyRaw, status: 'inconnu' })).toThrow('invalid_stats');
    expect(parseFamilyPage({ total: 1, page: 1, page_size: 50, rows: [familyRaw] })).toMatchObject({ total: 1, pageSize: 50, rows: [{ name: 'Gia đình A' }] });
    expect(parseFamilyDetail({ ...familyRaw, active_devices: 2, usage_30d: counters })).toMatchObject({ activeDevices: 2, usage30d: { tasksValidated: 4 } });
  });
  it('santé : base, appareils, tâches planifiées (ou inconnues)', () => {
    expect(parseHealth({ db_size_bytes: 1024, active_devices: 2, cron: null })).toEqual({ dbSizeBytes: 1024, activeDevices: 2, cron: null });
    expect(parseHealth({ db_size_bytes: 1024, active_devices: 2 }).cron).toBeNull();
    const h = parseHealth({ db_size_bytes: 1, active_devices: 0, cron: [{ jobname: 'j', schedule: '* * * * *', active: true, last_run_at: '2026-10-28T00:00:00Z', last_status: 'succeeded' }, { jobname: 'k', schedule: '0 * * * *', active: false, last_run_at: null, last_status: null }] });
    expect(h.cron).toHaveLength(2);
    expect(h.cron?.map(cronState)).toEqual(['ok', 'paused']);
  });
});

describe('mise en forme', () => {
  it('taille', () => {
    expect(formatBytes(500)).toBe('500 o');
    expect(formatBytes(2048)).toBe('2 Ko');
    expect(formatBytes(12_582_912)).toBe('12 Mo');
    expect(formatBytes(150 * 1024 * 1024)).toBe('150 Mo');
    expect(formatBytes(3.5 * 1024 ** 3)).toBe('3.5 Go');
    expect(formatBytes(5 * 1024 ** 5)).toBe('5120 To');
  });
  it('classe et pays', () => {
    expect(classLabel({ country: 'FR', grade: 'CM1' })).toBe('FR CM1');
    expect(classLabel({ country: null, grade: null })).toBe('— —');
    expect(countriesLabel([])).toBe('—');
    expect(countriesLabel(['FR', 'VN'])).toBe('FR · VN');
  });
  it('jours et dates : fuseau de la plateforme (UTC+7)', () => {
    expect(dayOf('2026-10-27T18:00:00Z')).toBe('2026-10-28');
    expect(dayOf('2026-10-27T16:59:00Z')).toBe('2026-10-27');
    expect(dayOf(null)).toBeNull();
    expect(dayOf('pas une date')).toBeNull();
    expect(shortDay('2026-10-28')).toBe('28/10');
    expect(formatStamp('2026-10-27T18:05:00Z')).toBe('28/10/2026 01:05');
    expect(formatStamp(null)).toBe('—');
    expect(formatStamp('x')).toBe('—');
    expect(formatDate('2026-10-27T18:05:00Z')).toBe('28/10/2026');
    expect(formatDate(null)).toBe('—');
  });
  it('tri : même colonne = sens inversé ; nouvelle colonne = ordre naturel', () => {
    expect(nextSort(DEFAULT_SORT, 'last_active_at')).toEqual({ sort: 'last_active_at', dir: 'asc' });
    expect(nextSort(DEFAULT_SORT, 'name')).toEqual({ sort: 'name', dir: 'asc' });
    expect(nextSort(DEFAULT_SORT, 'creator_email')).toEqual({ sort: 'creator_email', dir: 'asc' });
    expect(nextSort(DEFAULT_SORT, 'parents')).toEqual({ sort: 'parents', dir: 'desc' });
    expect(nextSort({ sort: 'name', dir: 'asc' }, 'name')).toEqual({ sort: 'name', dir: 'desc' });
  });
  it('pages', () => {
    expect(lastPage(0, 50)).toBe(1);
    expect(lastPage(50, 50)).toBe(1);
    expect(lastPage(51, 50)).toBe(2);
    expect(lastPage(120, 50)).toBe(3);
    expect(lastPage(10, 0)).toBe(10);
  });
  it('tâches planifiées : état de la dernière exécution', () => {
    const job = { jobname: 'j', schedule: '* * * * *', active: true, lastRunAt: '2026-10-28T00:00:00Z', lastStatus: 'succeeded' };
    expect(cronState(job)).toBe('ok');
    expect(cronState({ ...job, lastStatus: 'failed' })).toBe('failed');
    expect(cronState({ ...job, lastRunAt: null, lastStatus: null })).toBe('never');
    expect(cronState({ ...job, active: false })).toBe('paused');
  });
});

describe('barres des graphiques', () => {
  it('semaines : une barre par semaine, étiquette = lundi', () => {
    const bars = weekBars([{ weekStart: '2026-10-19', families: 3 }], (d, n) => `${d}:${n}`);
    expect(bars).toEqual([{ key: '2026-10-19', label: '19/10', segments: [{ value: 3, tone: 0 }], accessibilityLabel: '2026-10-19:3' }]);
  });
  it('jours : parents et enfants empilés ; une étiquette sur cinq, la dernière toujours posée', () => {
    const days = Array.from({ length: 11 }, (_, i) => ({ day: `2026-10-${String(i + 10).padStart(2, '0')}`, parents: 1, children: 2 }));
    const bars = dayBars(days, (d, p, c) => `${d}:${p}:${c}`);
    expect(bars).toHaveLength(11);
    expect(bars[10]).toMatchObject({ label: '20/10', segments: [{ value: 1, tone: 0 }, { value: 2, tone: 1 }], accessibilityLabel: '2026-10-20:1:2' });
    expect(bars.filter((b) => b.label !== '').map((b) => b.label)).toEqual(['10/10', '15/10', '20/10']);
  });
});
