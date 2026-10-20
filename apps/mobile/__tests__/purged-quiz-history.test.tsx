import { render, screen } from '@testing-library/react-native';
import '@/i18n';
import PointsHistoryScreen from '../app/(tabs)/more/points-history';
import NotificationsScreen from '../app/notifications';

const TITLE = 'Ngữ văn 7 · Ôn tập chung (bản thử)';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/hooks/useDisplayedChild', () => ({
  useDisplayedChild: () => ({
    me: { family: { id: 'f', timezone: 'Asia/Ho_Chi_Minh' }, member: { id: 'm' } },
    viewer: { role: 'parent', memberId: 'm', childId: null },
    children: [{ id: 'c1', name: 'Minh', birth_date: '2013-03-01', color: '#1E88F5' }],
    child: { id: 'c1', name: 'Minh', birth_date: '2013-03-01', color: '#1E88F5' }, select: jest.fn(),
  }),
}));
// la ligne de points référence une tentative (ref_id) qui n'existe plus : l'écran ne la relit jamais
jest.mock('@/hooks/usePoints', () => ({
  useTransactions: () => ({ data: [{ id: 'tx1', child_id: 'c1', family_id: 'f', delta: 8, reason: 'quiz_validated', ref_id: 'attempt-purgee', note: 'Ngữ văn 7 · Ôn tập chung (bản thử)', created_by: 'm', created_at: '2026-10-19T03:00:00Z' }] }),
}));
jest.mock('@/hooks/useNotifications', () => ({
  useActivity: () => ({
    data: [
      { id: 'a1', family_id: 'f', child_id: 'c1', actor_member_id: 'm', type: 'quiz_validated', payload: { attempt_id: 'attempt-purgee', quiz_id: 'quiz-purge', title: 'Ngữ văn 7 · Ôn tập chung (bản thử)', points: 8 }, created_at: '2026-10-19T03:00:00Z' },
      { id: 'a2', family_id: 'f', child_id: 'c1', actor_member_id: 'm', type: 'quiz_submitted', payload: { attempt_id: 'attempt-purgee', quiz_id: 'quiz-purge', title: 'Ngữ văn 7 · Ôn tập chung (bản thử)' }, created_at: '2026-10-19T02:00:00Z' },
    ],
  }),
  useDecidedRequests: () => ({ data: [] }),
}));
jest.mock('@/hooks/useApprovals', () => ({ useApprovalCounts: () => ({ total: 0, tasks: 0, requests: 0 }) }));

describe('QCM supprimé définitivement : l\'historique reste propre (D-091)', () => {
  it('historique des points : la ligne « quiz_validated » garde son libellé, sa note (le titre) et ses points', async () => {
    await render(<PointsHistoryScreen />);
    expect(screen.getByText('Quiz tuần đã duyệt')).toBeTruthy();
    expect(screen.getByText(new RegExp(TITLE.replace(/[()·]/g, '.')))).toBeTruthy();
    expect(screen.getByText('+8')).toBeTruthy();
  });

  it('centre de notifications : les lignes d\'un quiz purgé s\'affichent avec le titre de la charge utile, sans lire la tentative', async () => {
    await render(<NotificationsScreen />);
    expect(screen.getByText(`Đã duyệt bài ôn tập của Minh: ${TITLE}`)).toBeTruthy();
    expect(screen.getAllByText(new RegExp(TITLE.replace(/[()·]/g, '.'))).length).toBe(2);
  });
});
