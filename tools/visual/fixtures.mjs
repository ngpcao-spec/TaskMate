// Données de démo alignées sur les maquettes : Minh 17 ans, Khang 13 ans, 4/7 tâches faites aujourd'hui, 320 points, objectifs, stats 72 %.
const u = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
export const ids = { fam: u(1), parent: u(11), minhUser: u(13), khangUser: u(14), minh: u(201), khang: u(202), mParent: u(111), mMinh: u(113), mKhang: u(114) };

const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function dates() {
  const now = new Date();
  const today = fmt(now);
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return fmt(d); });
  return { today, week };
}

export function build() {
  const { today, week } = dates();
  const stamp = new Date().toISOString();
  const base = { created_at: stamp, updated_at: stamp, deleted_at: null };
  let n = 1000;
  const task = (child, title, category, date, kind, start, end, state, extra = {}) => ({
    id: u(n++), family_id: ids.fam, child_id: child, title, category, note: null, date, time_kind: kind, start_time: start, end_time: end, points: 10,
    completed_at: state === 'todo' ? null : stamp, completed_by: state === 'todo' ? null : (child === ids.minh ? ids.mMinh : ids.mKhang),
    validated_at: state === 'validated' ? stamp : null, validated_by: state === 'validated' ? ids.mParent : null,
    rejection_note: null, rejected_at: null, recurrence_id: null, created_by: ids.mParent, ...base, ...extra,
  });
  const tasks = [
    task(ids.minh, 'Học tiếng Anh (45 phút)', 'study', today, 'range', '08:00:00', '08:45:00', 'validated'),
    task(ids.minh, 'Làm bài tập Toán', 'study', today, 'range', '10:00:00', '11:00:00', 'validated'),
    task(ids.minh, 'Giặt quần áo', 'chores', today, 'range', '12:00:00', '12:30:00', 'pending'),
    task(ids.minh, 'Ôn từ vựng', 'study', today, 'range', '14:00:00', '14:30:00', 'pending'),
    task(ids.minh, 'Tập gym', 'sport', today, 'range', '17:00:00', '18:00:00', 'todo'),
    task(ids.minh, 'Đọc sách (30 phút)', 'personal', today, 'range', '20:00:00', '20:30:00', 'todo'),
    task(ids.minh, 'Dọn phòng', 'chores', today, 'deadline', null, '21:00:00', 'todo', { rejection_note: 'Dọn cả gầm giường nhé' }),
  ];
  // Statistiques de la semaine : 36 tâches dont 26 cochées ; répartition 16/7/5/4/4 (≈ 45 / 20 / 15 / 10 / 10 %)
  const dist = [['study', 16], ['sport', 7], ['chores', 5], ['personal', 4], ['other', 4]];
  let doneLeft = 26 - tasks.filter((t) => t.completed_at).length;
  let i = 0;
  const already = { study: 4, sport: 1, chores: 2, personal: 1, other: 0 };
  for (const [cat, count] of dist) {
    for (let k = already[cat] ?? 0; k < count; k++) {
      const date = week[i++ % 7];
      if (date === today && i % 2) continue;
      const done = doneLeft > 0 && (k + i) % 3 !== 0;
      if (done) doneLeft--;
      tasks.push(task(ids.minh, `Việc ${cat} ${k + 1}`, cat, date, 'anytime', null, null, done ? 'validated' : 'todo'));
    }
  }
  // Calendrier : les 7 tâches du jour + quelques autres (maquette : 5 cartes colorées)
  const khangTasks = [task(ids.khang, 'Làm bài tập Văn', 'study', today, 'range', '16:00:00', '17:00:00', 'todo'), task(ids.khang, 'Dọn phòng', 'chores', today, 'deadline', null, '21:00:00', 'todo')];
  const family = { id: ids.fam, name: 'Gia đình Nguyễn', timezone: 'Asia/Ho_Chi_Minh', ...base };
  const birth = (years) => { const d = new Date(); d.setFullYear(d.getFullYear() - years); d.setMonth(d.getMonth() - 2); return fmt(d); };
  return {
    families: [family],
    children: [
      { id: ids.minh, family_id: ids.fam, name: 'Minh', birth_date: birth(17), avatar: null, color: '#1E88F5', label: 'Con trai lớn', sort_order: 1, ...base },
      { id: ids.khang, family_id: ids.fam, name: 'Khang', birth_date: birth(13), avatar: null, color: '#2EC4A6', label: 'Con trai út', sort_order: 2, ...base },
    ],
    members: [
      { id: ids.mParent, family_id: ids.fam, user_id: ids.parent, role: 'parent', child_id: null, display_name: 'Ba', revoked_at: null, ...base },
      { id: ids.mMinh, family_id: ids.fam, user_id: ids.minhUser, role: 'child', child_id: ids.minh, display_name: 'Minh', revoked_at: null, ...base },
      { id: ids.mKhang, family_id: ids.fam, user_id: ids.khangUser, role: 'child', child_id: ids.khang, display_name: 'Khang', revoked_at: null, ...base },
    ],
    tasks: [...tasks, ...khangTasks],
    goals: [
      { id: u(901), family_id: ids.fam, child_id: ids.minh, title: 'Học tốt, đạt điểm cao', icon: 'target', target: 5, progress: 3, unit: null, achieved_at: null, created_by: ids.mMinh, ...base },
      { id: u(902), family_id: ids.fam, child_id: ids.minh, title: 'Tập gym đều đặn', icon: 'dumbbell', target: 4, progress: 2, unit: null, achieved_at: null, created_by: ids.mMinh, ...base },
      { id: u(903), family_id: ids.fam, child_id: ids.minh, title: 'Đọc 12 cuốn sách trong năm', icon: 'book-open', target: 12, progress: 4, unit: null, achieved_at: null, created_by: ids.mMinh, ...base },
      { id: u(904), family_id: ids.fam, child_id: ids.minh, title: 'Tiết kiệm tiền', icon: 'star', target: 5, progress: 1, unit: null, achieved_at: null, created_by: ids.mMinh, ...base },
    ],
    rewards: [
      { id: u(401), family_id: ids.fam, title: 'Chơi game 1 tiếng', icon: 'gift', cost: 100, child_id: null, sort_order: 1, ...base },
      { id: u(402), family_id: ids.fam, title: 'Xem phim yêu thích', icon: 'film', cost: 150, child_id: null, sort_order: 2, ...base },
      { id: u(403), family_id: ids.fam, title: 'Dùng điện thoại thêm 30 phút', icon: 'smartphone', cost: 200, child_id: null, sort_order: 3, ...base },
      { id: u(404), family_id: ids.fam, title: 'Đồ ăn vặt', icon: 'cookie', cost: 100, child_id: null, sort_order: 4, ...base },
    ],
    child_balances: [
      { child_id: ids.minh, family_id: ids.fam, balance: 320, reserved: 0, available: 320, pending_task_points: 20 },
      { child_id: ids.khang, family_id: ids.fam, balance: 80, reserved: 0, available: 80, pending_task_points: 0 },
    ],
    reward_requests: [], point_transactions: [], activity_log: [], notification_prefs: [], devices: [], recurrences: [], child_accounts: [], parent_invites: [],
  };
}
