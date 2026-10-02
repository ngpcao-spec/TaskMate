import { filterTasks } from './task-filters';

const mk = (title: string, date: string, over: Record<string, unknown> = {}) => ({
  title, date, time_kind: 'range' as const, start_time: '08:00', end_time: '09:00', completed_at: null as string | null, ...over,
});
const today = '2026-07-02';
const tasks = [
  mk('Làm bài tập Toán', '2026-07-02'),
  mk('Đọc sách', '2026-07-03'),
  mk('Dọn phòng', '2026-06-30'),
  mk('Tập thể dục', '2026-07-01', { completed_at: '2026-07-01T10:00:00Z' }),
  mk('Học tiếng Anh', '2026-07-02', { end_time: '07:00' }),
];

describe('filterTasks', () => {
  it('à venir : non faites et pas en retard, par date croissante', () => {
    expect(filterTasks(tasks, 'upcoming', '', today, '08:30').map((t) => t.title)).toEqual(['Làm bài tập Toán', 'Đọc sách']);
  });
  it('faites', () => {
    expect(filterTasks(tasks, 'done', '', today, '08:30').map((t) => t.title)).toEqual(['Tập thể dục']);
  });
  it('en retard : jour passé ou fin dépassée aujourd’hui, plus récentes d’abord', () => {
    expect(filterTasks(tasks, 'overdue', '', today, '08:30').map((t) => t.title)).toEqual(['Học tiếng Anh', 'Dọn phòng']);
  });
  it('recherche insensible à la casse et aux accents (đ → d)', () => {
    expect(filterTasks(tasks, 'upcoming', 'TOAN', today, '08:30').map((t) => t.title)).toEqual(['Làm bài tập Toán']);
    expect(filterTasks(tasks, 'upcoming', 'doc sach', today, '08:30').map((t) => t.title)).toEqual(['Đọc sách']);
    expect(filterTasks(tasks, 'upcoming', 'zzz', today, '08:30')).toEqual([]);
  });
});
