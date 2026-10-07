import { fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import RenewTaskScreen from '../app/task/renew';
import { RenewTask } from '@/components/RenewTask';
import type { ChildRow, TaskRow } from '@/types/models';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
  useLocalSearchParams: () => ({ id: 't1' }),
  Redirect: (props: { href: string }) => { mockRedirect(props.href); return null; },
}));
const mockRedirect = jest.fn();
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, default: () => null }));
// jour local de la famille figé : vendredi 3 juillet 2026
jest.mock('@/domain/family-time', () => ({ ...jest.requireActual('@/domain/family-time'), todayInTz: () => '2026-07-03' }));
let mockSeq = 0;
jest.mock('@/api/ids', () => ({ newId: () => `id-${++mockSeq}` }));
jest.mock('@/components/PickerField', () => jest.requireActual('@/components/PickerField.web'));

const minh = { id: 'c-minh', name: 'Minh', birth_date: '2009-03-01', color: '#1E88F5' } as ChildRow;
const khang = { id: 'c-khang', name: 'Khang', birth_date: '2013-05-01', color: '#2EC4A6' } as ChildRow;
const source = {
  id: 't1', family_id: 'f', child_id: 'c-minh', title: 'Tập đàn', category: 'personal', note: 'Gam Đô', date: '2026-07-02', time_kind: 'range',
  start_time: '08:00:00', end_time: '08:45:00', points: 15, completed_at: '2026-07-02T01:00:00Z', validated_at: '2026-07-02T02:00:00Z', rejection_note: null, deleted_at: null,
} as TaskRow;

let mockRole: 'parent' | 'child' = 'parent';
let mockChildren: ChildRow[] = [minh, khang];
let mockExisting: TaskRow[] = [];
const mockCreate = jest.fn();
const mockSeries = jest.fn();
jest.mock('@/hooks/useMe', () => ({ useMe: () => ({ data: { member: { role: mockRole, id: 'm-p' }, family: { id: 'f', timezone: 'Asia/Ho_Chi_Minh' }, children: [] } }) }));
jest.mock('@/hooks/useDisplayedChild', () => ({
  useDisplayedChild: () => ({
    me: { family: { id: 'f', timezone: 'Asia/Ho_Chi_Minh' }, member: { id: 'm-p' } },
    viewer: { role: mockRole, memberId: 'm-p', childId: null },
    children: mockChildren, child: minh, select: jest.fn(),
  }),
}));
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQuery: () => ({ isPending: false, data: source }),
  useQueries: ({ queries }: { queries: unknown[] }) => queries.map(() => ({ data: mockExisting })),
}));
jest.mock('@/hooks/useTasks', () => ({ useCreateTasks: () => ({ mutate: mockCreate, isPending: false }) }));
jest.mock('@/hooks/useRecurrences', () => ({ useCreateRecurrences: () => ({ mutate: mockSeries, isPending: false }) }));

const day = (label: RegExp) => screen.getByRole('checkbox', { name: label });
const confirm = () => screen.getByRole('button', { name: 'Tạo' });

describe('RenewTask — autres jours', () => {
  beforeEach(() => { jest.clearAllMocks(); mockRole = 'parent'; mockChildren = [minh, khang]; mockExisting = []; });

  it('copie sur deux jours : tâches « à faire » identiques (sauf la date), résumé lisible, source intacte', async () => {
    await render(<RenewTask task={source} />);
    expect(confirm().props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(day(/, 9 tháng 7/));
    await fireEvent.press(day(/, 10 tháng 7/));
    expect(screen.getByText('Sẽ tạo 2 việc, từ 09/07/2026 đến 10/07/2026.')).toBeTruthy();
    await fireEvent.press(confirm());
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const { tasks, familyId, memberId } = mockCreate.mock.calls[0]?.[0] as { familyId: string; memberId: string; tasks: Record<string, unknown>[] };
    expect([familyId, memberId]).toEqual(['f', 'm-p']);
    expect(tasks.map((t) => t.date)).toEqual(['2026-07-09', '2026-07-10']);
    expect(tasks[0]).toMatchObject({ child_id: 'c-minh', title: 'Tập đàn', category: 'personal', note: 'Gam Đô', time_kind: 'range', start_time: '08:00:00', end_time: '08:45:00', points: 15 });
    expect(tasks[0]).not.toHaveProperty('completed_at');
    expect(tasks[0]).not.toHaveProperty('validated_at');
    expect(new Set(tasks.map((t) => t.id)).size).toBe(2); // ids fixés à la création
    expect(mockBack).toHaveBeenCalled();
    expect(source.completed_at).toBe('2026-07-02T01:00:00Z');
  });

  it('les jours passés ne sont pas sélectionnables ; le mois suivant est proposé', async () => {
    await render(<RenewTask task={source} />);
    expect(day(/, 2 tháng 7/).props.accessibilityState).toMatchObject({ disabled: true });
    expect(day(/, 3 tháng 7/).props.accessibilityState).toMatchObject({ disabled: false });
    expect(day(/, 31 tháng 8/)).toBeTruthy();
  });

  it('jour déjà occupé par la même tâche : signalé, non recréé, signalé dans le résumé', async () => {
    mockExisting = [{ ...source, id: 'e1', date: '2026-07-09', completed_at: null, validated_at: null } as TaskRow];
    await render(<RenewTask task={source} />);
    expect(screen.getByRole('checkbox', { name: /9 tháng 7.*đã có việc này/ })).toBeTruthy();
    await fireEvent.press(day(/, 9 tháng 7/));
    await fireEvent.press(day(/, 10 tháng 7/));
    expect(screen.getByText('Sẽ tạo 1 việc, từ 10/07/2026 đến 10/07/2026.')).toBeTruthy();
    expect(screen.getByText('1 việc giống hệt đã có, sẽ không tạo lại.')).toBeTruthy();
    await fireEvent.press(confirm());
    expect((mockCreate.mock.calls[0]?.[0] as { tasks: { date: string }[] }).tasks.map((t) => t.date)).toEqual(['2026-07-10']);
  });

  it('un autre enfant (prénoms) : chaque enfant reçoit sa propre tâche ; au moins un enfant requis', async () => {
    await render(<RenewTask task={source} />);
    await fireEvent.press(day(/, 9 tháng 7/));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Khang' }));
    await fireEvent.press(confirm());
    const { tasks } = mockCreate.mock.calls[0]?.[0] as { tasks: { child_id: string }[] };
    expect(tasks.map((t) => t.child_id)).toEqual(['c-minh', 'c-khang']);
  });

  it('sans aucun enfant sélectionné : message et bouton inactif', async () => {
    await render(<RenewTask task={source} />);
    await fireEvent.press(day(/, 9 tháng 7/));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Minh' }));
    expect(screen.getByText('Chọn ít nhất một bạn')).toBeTruthy();
    expect(confirm().props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('un seul enfant dans la famille : pas de sélecteur d’enfant', async () => {
    mockChildren = [minh];
    await render(<RenewTask task={source} />);
    expect(screen.queryByRole('checkbox', { name: 'Minh' })).toBeNull();
  });

  it('plafond : jusqu’à 120 tâches permis, au-delà message clair et bouton inactif', async () => {
    mockChildren = [minh, khang, { id: 'c-cam', name: 'Cam', birth_date: '2016-02-01', color: '#8B5CF6' } as ChildRow];
    await render(<RenewTask task={source} />);
    for (let n = 3; n <= 31; n++) await fireEvent.press(day(new RegExp(`, ${n} tháng 7`)));
    for (let n = 1; n <= 31; n++) await fireEvent.press(day(new RegExp(`, ${n} tháng 8`)));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Khang' })); // 60 jours × 2 enfants = 120
    expect(screen.queryByText(/Quá nhiều việc/)).toBeNull();
    expect(confirm().props.accessibilityState).toMatchObject({ disabled: false });
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Cam' })); // 180 > 120
    expect(screen.getByText('Quá nhiều việc cùng lúc (tối đa 120). Hãy giảm số ngày, số tuần hoặc số bạn.')).toBeTruthy();
    expect(confirm().props.accessibilityState).toMatchObject({ disabled: true });
  });
});

describe('RenewTask — chaque semaine', () => {
  beforeEach(() => { jest.clearAllMocks(); mockRole = 'parent'; mockChildren = [minh, khang]; mockExisting = []; });
  const weekly = async () => { await render(<RenewTask task={source} />); await fireEvent.press(screen.getByRole('radio', { name: 'Hằng tuần' })); };

  it('jeudi (source) coché par défaut ; lundi + jeudi sur 4 semaines → une récurrence ISO [1,4] avec fin', async () => {
    await weekly();
    expect(screen.getByRole('checkbox', { name: 'T5' }).props.accessibilityState).toMatchObject({ checked: true });
    await fireEvent.press(screen.getByRole('checkbox', { name: 'T2' }));
    expect(screen.getByText('Chuỗi hằng tuần: 8 việc, từ 06/07/2026 đến 30/07/2026.')).toBeTruthy();
    await fireEvent.press(confirm());
    expect(mockSeries).toHaveBeenCalledTimes(1);
    const { rows } = mockSeries.mock.calls[0]?.[0] as { rows: Record<string, unknown>[] };
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ child_id: 'c-minh', rule: 'weekdays', weekdays: [1, 4], starts_on: '2026-07-03', ends_on: '2026-07-30', title: 'Tập đàn', points: 15 });
  });

  it('chips de jours : T5 = 4 (jamais 3), CN = 7', async () => {
    await weekly();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'T5' })); // décocher le jeudi
    await fireEvent.press(screen.getByRole('checkbox', { name: 'CN' }));
    await fireEvent.press(confirm());
    expect((mockSeries.mock.calls[0]?.[0] as { rows: { weekdays: number[] }[] }).rows[0]?.weekdays).toEqual([7]);
  });

  it('nombre de semaines, sans fin, deux enfants → une série par enfant', async () => {
    await weekly();
    await fireEvent.press(screen.getByRole('button', { name: 'Thêm một tuần' }));
    expect(screen.getByText('5 tuần')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Bớt một tuần' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Không kết thúc' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Khang' }));
    expect(screen.getByText(/Chuỗi không kết thúc/)).toBeTruthy();
    await fireEvent.press(confirm());
    const { rows } = mockSeries.mock.calls[0]?.[0] as { rows: { child_id: string; ends_on: string | null }[] };
    expect(rows.map((r) => [r.child_id, r.ends_on])).toEqual([['c-minh', null], ['c-khang', null]]);
  });

  it('date de fin avant le début : erreur et bouton inactif', async () => {
    await weekly();
    await fireEvent.press(screen.getByRole('radio', { name: 'Đến ngày' }));
    await fireEvent(screen.getByLabelText('Ngày kết thúc'), 'change', { target: { value: '2026-07-01' } });
    expect(screen.getByText('Ngày kết thúc phải sau ngày bắt đầu')).toBeTruthy();
    expect(confirm().props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('aucun jour de la semaine : erreur', async () => {
    await weekly();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'T5' }));
    expect(screen.getByText('Chọn ít nhất một thứ trong tuần')).toBeTruthy();
    expect(confirm().props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('doublon dans les 14 prochains jours : avertissement, il faut confirmer explicitement', async () => {
    mockExisting = [{ ...source, id: 'e1', date: '2026-07-09', completed_at: null, validated_at: null } as TaskRow];
    await weekly();
    expect(screen.getByText('1 việc giống hệt đã có trong 14 ngày tới và sẽ bị trùng.')).toBeTruthy();
    expect(confirm().props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Vẫn tạo dù bị trùng' }));
    expect(confirm().props.accessibilityState).toMatchObject({ disabled: false });
    await fireEvent.press(confirm());
    expect(mockSeries).toHaveBeenCalledTimes(1);
  });
});

describe('route « Renouveler » — parent uniquement', () => {
  beforeEach(() => { jest.clearAllMocks(); mockChildren = [minh, khang]; });
  it('un enfant est redirigé, sans voir l’écran', async () => {
    mockRole = 'child';
    await render(<RenewTaskScreen />);
    expect(mockRedirect).toHaveBeenCalledWith('/');
    expect(screen.queryByText('Lặp lại công việc')).toBeNull();
  });
  it('un parent voit l’écran', async () => {
    mockRole = 'parent';
    await render(<RenewTaskScreen />);
    expect(screen.getByText('Lặp lại công việc')).toBeTruthy();
    expect(screen.getByText('Việc gốc: Tập đàn')).toBeTruthy();
  });
});
