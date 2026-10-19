import { fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import NotificationSettingsScreen from '../app/(tabs)/more/notification-settings';
import { DEFAULT_PREFS as mockPrefs } from '@/domain/notification-prefs';

jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));
let mockRole: 'parent' | 'child' = 'child';
const mockSave = jest.fn();
jest.mock('@/hooks/useMe', () => ({ useMe: () => ({ data: { member: { role: mockRole } } }) }));
jest.mock('@/hooks/useNotifications', () => ({
  useNotificationPrefs: () => ({ data: mockPrefs }),
  useSavePrefs: () => ({ mutate: mockSave, isPending: false }),
}));

describe('NotificationSettingsScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('enfant : rappels avec valeurs par défaut 10 / 30 min, pas d’activité des enfants', async () => {
    mockRole = 'child';
    await render(<NotificationSettingsScreen />);
    expect(screen.getByLabelText('Nhắc trước giờ bắt đầu (phút)').props.value).toBe('10');
    expect(screen.getByLabelText('Nhắc trước hạn chót (phút)').props.value).toBe('30');
    expect(screen.queryByText('Hoạt động của các con')).toBeNull();
  });

  it('enregistre des minutes modifiées ; champ vide = désactivé', async () => {
    mockRole = 'child';
    await render(<NotificationSettingsScreen />);
    await fireEvent.changeText(screen.getByLabelText('Nhắc trước giờ bắt đầu (phút)'), '5');
    await fireEvent.changeText(screen.getByLabelText('Nhắc trước hạn chót (phút)'), '');
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu' }));
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ reminderBeforeStartMin: 5, reminderBeforeDeadlineMin: null }));
  });

  it('refuse une heure de récap invalide', async () => {
    mockRole = 'child';
    await render(<NotificationSettingsScreen />);
    await fireEvent.changeText(screen.getByLabelText('Giờ tổng kết'), '25:99');
    expect(screen.getByText('Giờ không hợp lệ (HH:MM)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lưu' }).props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('parent : interrupteurs d’activité des enfants, chacun activable', async () => {
    mockRole = 'parent';
    await render(<NotificationSettingsScreen />);
    expect(screen.getByText('Hoạt động của các con')).toBeTruthy();
    await fireEvent(screen.getByLabelText('Khi con đánh dấu xong việc (cần duyệt)'), 'valueChange', false);
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu' }));
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ activity: { taskDone: false, rewardRequested: true, goalAchieved: true, quizSubmitted: true, quizValidated: true } }));
    expect(screen.queryByLabelText('Nhắc trước giờ bắt đầu (phút)')).toBeNull();
  });

  it('parent : interrupteur « quiz terminé, à valider » (D-088), sans celui de l’enfant', async () => {
    mockRole = 'parent';
    await render(<NotificationSettingsScreen />);
    expect(screen.queryByLabelText('Khi bố mẹ duyệt bài ôn tập của bạn')).toBeNull();
    const toggle = screen.getByLabelText('Khi con làm xong bài ôn tập (cần duyệt)');
    expect(toggle.props.value).toBe(true);
    await fireEvent(toggle, 'valueChange', false);
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu' }));
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ activity: expect.objectContaining({ quizSubmitted: false, quizValidated: true }) }));
  });

  it('enfant : interrupteur « mon quiz a été validé » (D-088), sans ceux du parent', async () => {
    mockRole = 'child';
    await render(<NotificationSettingsScreen />);
    expect(screen.queryByLabelText('Khi con làm xong bài ôn tập (cần duyệt)')).toBeNull();
    const toggle = screen.getByLabelText('Khi bố mẹ duyệt bài ôn tập của bạn');
    expect(toggle.props.value).toBe(true);
    await fireEvent(toggle, 'valueChange', false);
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu' }));
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({ activity: expect.objectContaining({ quizValidated: false, quizSubmitted: true }) }));
  });
});
