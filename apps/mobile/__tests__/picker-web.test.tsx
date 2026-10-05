import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import '@/i18n';
import { PickerField } from '@/components/PickerField.web';
import { TaskForm } from '@/components/TaskForm';
import type { ChildRow } from '@/types/models';

// TaskForm importe « PickerField » : sur le web, Metro résout PickerField.web.tsx — on reproduit ce choix sous Jest.
jest.mock('@/components/PickerField', () => jest.requireActual('@/components/PickerField.web'));
// Sur le web le paquet natif ne rend RIEN (cause du bug) : le laisser nul prouve que le formulaire n'en dépend plus.
jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, default: () => null }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));

const minh = { id: 'c-minh', name: 'Minh', birth_date: '2009-03-01', color: '#1E88F5' } as ChildRow;
const mockCreate = jest.fn();
jest.mock('@/hooks/useDisplayedChild', () => ({
  useDisplayedChild: () => ({
    me: { family: { timezone: 'Asia/Ho_Chi_Minh', id: 'f1' }, member: { id: 'm-p' } },
    viewer: { role: 'parent', memberId: 'm-p', childId: null },
    children: [minh], child: minh, select: jest.fn(),
  }),
}));
jest.mock('@/hooks/useTasks', () => ({
  useCreateTasks: () => ({ mutate: mockCreate, isPending: false }),
  useUpdateTask: () => ({ mutate: jest.fn(), isPending: false }),
  useDeleteTask: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock('@/hooks/useRecurrences', () => ({
  useCreateRecurrences: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateRecurrence: () => ({ mutate: jest.fn(), isPending: false }),
  useDeleteRecurrence: () => ({ mutate: jest.fn(), isPending: false }),
}));

const change = async (label: string, value: string) => fireEvent(screen.getByLabelText(label), 'change', { target: { value } });

describe('PickerField (web)', () => {
  it('heure : champ <input type="time"> libellé, valeur « HH:MM » telle quelle', async () => {
    const onChange = jest.fn();
    await render(<PickerField label="Đến" mode="time" value="09:30" onChange={onChange} />);
    const input = screen.getByLabelText('Đến');
    expect(input.type).toBe('input');
    expect(input.props.type).toBe('time');
    expect(input.props.value).toBe('09:30');
    await change('Đến', '10:45');
    expect(onChange).toHaveBeenCalledWith('10:45');
  });

  it('date : champ <input type="date">, valeur « YYYY-MM-DD » sans décalage de fuseau', async () => {
    const onChange = jest.fn();
    await render(<PickerField label="Ngày" mode="date" value="2026-07-02" onChange={onChange} />);
    expect(screen.getByLabelText('Ngày').props.type).toBe('date');
    await change('Ngày', '2026-12-31');
    expect(onChange).toHaveBeenCalledWith('2026-12-31'); // chaîne brute : jamais de Date / toISOString
  });

  it('champ vidé par le navigateur : aucune valeur vide n’est émise', async () => {
    const onChange = jest.fn();
    await render(<PickerField label="Từ" mode="time" value="08:00" onChange={onChange} />);
    await change('Từ', '');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('affiche l’erreur (role alert) et marque le champ invalide ; cible ≥ 44 pt', async () => {
    await render(<PickerField label="Đến" mode="time" value="07:00" onChange={jest.fn()} error="Giờ kết thúc phải sau giờ bắt đầu" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Giờ kết thúc phải sau giờ bắt đầu');
    expect(screen.getByLabelText('Đến').props['aria-invalid']).toBe(true);
    expect(screen.getByLabelText('Đến').props.style.minHeight).toBeGreaterThanOrEqual(44);
  });

  it('sans erreur : pas d’alerte', async () => {
    await render(<PickerField label="Đến" mode="time" value="07:00" onChange={jest.fn()} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('TaskForm avec le sélecteur web', () => {
  const open = async () => {
    await render(<TaskForm />);
    await fireEvent.changeText(screen.getByLabelText('Tên công việc'), 'Học bài');
    await fireEvent.press(screen.getByRole('button', { name: /^Thời gian/ }));
  };
  const save = () => screen.getByRole('button', { name: 'Lưu' });

  it('« Khoảng giờ » : date, début et fin sont modifiables et enregistrés tels quels', async () => {
    await open();
    await fireEvent.press(screen.getByRole('radio', { name: 'Khoảng giờ' }));
    await change('Ngày', '2026-08-15');
    await change('Từ', '09:00');
    await change('Đến', '10:30');
    await waitFor(() => expect(save().props.accessibilityState).toMatchObject({ disabled: false }));
    await fireEvent.press(save());
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    const { tasks } = mockCreate.mock.calls[0]?.[0] as { tasks: { date: string; start_time: string; end_time: string; time_kind: string }[] };
    expect(tasks[0]).toMatchObject({ date: '2026-08-15', time_kind: 'range' });
    expect(tasks[0]?.start_time).toMatch(/^09:00/);
    expect(tasks[0]?.end_time).toMatch(/^10:30/);
  });

  it('« Khoảng giờ » : fin ≤ début → erreur affichée et enregistrement bloqué', async () => {
    await open();
    await fireEvent.press(screen.getByRole('radio', { name: 'Khoảng giờ' }));
    await change('Từ', '10:00');
    await change('Đến', '09:00');
    expect(await screen.findByText('Giờ kết thúc phải sau giờ bắt đầu')).toBeTruthy();
    expect(save().props.accessibilityState).toMatchObject({ disabled: true });
    await change('Đến', '11:00');
    await waitFor(() => expect(screen.queryByText('Giờ kết thúc phải sau giờ bắt đầu')).toBeNull());
    await waitFor(() => expect(save().props.accessibilityState).toMatchObject({ disabled: false }));
  });

  it('« Trước giờ » : une seule heure (fin), pas de champ « Từ », modifiable', async () => {
    await open();
    await fireEvent.press(screen.getByRole('radio', { name: 'Trước giờ' }));
    expect(screen.queryByLabelText('Từ')).toBeNull();
    await change('Trước', '18:15');
    await waitFor(() => expect(save().props.accessibilityState).toMatchObject({ disabled: false }));
    await fireEvent.press(save());
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    const { tasks } = mockCreate.mock.calls.at(-1)?.[0] as { tasks: { start_time: string | null; end_time: string; time_kind: string }[] };
    expect(tasks[0]).toMatchObject({ time_kind: 'deadline', start_time: null });
    expect(tasks[0]?.end_time).toMatch(/^18:15/);
  });
});
