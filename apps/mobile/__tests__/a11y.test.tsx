import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import '@/i18n';
import { CalendarCard } from '@/components/CalendarCard';
import { Chip } from '@/components/Chip';
import { Fab } from '@/components/Fab';
import { ProfilePills } from '@/components/ProfilePills';
import { TaskRow } from '@/components/TaskRow';
import { WeekStrip } from '@/components/WeekStrip';
import { Button, Field } from '@/components/ui';
import { weekDays } from '@/domain/calendar';
import { MIN_TARGET } from '@/theme/tokens';
import type { ChildRow, TaskRow as Task } from '@/types/db';

jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));

const ROLES = ['button', 'checkbox', 'radio', 'tab'] as const;
const task = { id: 't1', title: 'Làm bài tập', category: 'study', date: '2026-07-02', time_kind: 'range', start_time: '08:00:00', end_time: '08:45:00', completed_at: null, child_id: 'c', created_by: 'm' } as Task;
const child = { id: 'c1', name: 'Minh', birth_date: '2009-03-01', color: '#1E88F5' } as ChildRow;

function interactive() {
  return ROLES.flatMap((role) => screen.queryAllByRole(role));
}

describe('accessibilité', () => {
  const cases: [string, () => React.ReactElement][] = [
    ['Button', () => <Button label="Lưu" onPress={() => undefined} />],
    ['Chip', () => <Chip label="Học tập" selected={false} onPress={() => undefined} />],
    ['Fab', () => <Fab label="Thêm việc" onPress={() => undefined} />],
    ['TaskRow', () => <TaskRow task={task} overdue={false} canToggle canEdit onToggle={() => undefined} onOpen={() => undefined} />],
    ['CalendarCard', () => <CalendarCard task={task} overdue={false} onPress={() => undefined} />],
    ['ProfilePills', () => <ProfilePills profiles={[child]} selectedId="c1" onSelect={() => undefined} today="2026-07-02" />],
    ['WeekStrip', () => <WeekStrip days={weekDays('2026-07-02')} selected="2026-07-02" today="2026-07-02" lang="vi" onSelect={() => undefined} />],
  ];

  it.each(cases)('%s : chaque élément interactif a un libellé accessible', async (_name, ui) => {
    await render(ui());
    const items = interactive();
    expect(items.length).toBeGreaterThan(0);
    for (const el of items) {
      const label = el.props.accessibilityLabel as string | undefined;
      expect(typeof label === 'string' && label.trim().length > 0).toBe(true);
    }
  });

  it.each(cases)('%s : cibles tactiles ≥ 44 pt', async (_name, ui) => {
    await render(ui());
    for (const el of interactive()) {
      const style = StyleSheet.flatten(el.props.style) ?? {};
      const height = Math.max(Number(style.minHeight ?? 0), Number(style.height ?? 0));
      expect(height).toBeGreaterThanOrEqual(MIN_TARGET);
    }
  });

  it('Field : le champ de saisie porte le libellé', async () => {
    await render(<Field label="Tên công việc" value="" onChangeText={() => undefined} />);
    expect(screen.getByLabelText('Tên công việc')).toBeTruthy();
  });

  it('la case à cocher expose son état (coché / désactivé) aux lecteurs d’écran', async () => {
    await render(<TaskRow task={{ ...task, completed_at: 'x' }} overdue={false} canToggle={false} canEdit={false} onToggle={() => undefined} onOpen={() => undefined} />);
    expect(screen.getByRole('checkbox', { name: 'Làm bài tập' }).props.accessibilityState).toMatchObject({ checked: true, disabled: true });
  });
});
