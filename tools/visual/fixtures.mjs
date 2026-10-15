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
    // dessin de démonstration (illustration générée pour les captures, aucune photo) : Minh a un avatar, Khang n'a pas le consentement
    child_avatars: [
      { child_id: ids.minh, family_id: ids.fam, ai_allowed: true, image_b64: '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', version: 1, updated_at: base.updated_at },
      { child_id: ids.khang, family_id: ids.fam, ai_allowed: false, image_b64: null, version: 0, updated_at: base.updated_at },
    ],
    // Quiz de la semaine (D-079) : statuts variés côté parent (dimanche = week[6]) ; `quiz_questions: [{ count }]` imite l'embarqué PostgREST
    quiz_sets: [
      { id: u(701), family_id: ids.fam, child_id: ids.minh, title: 'Địa lý Việt Nam', subject: 'Địa lý', status: 'published', created_by: ids.mParent, material_kind: 'course', kind_detected: false, paper_support: false, answer_sheet_only: false, due_on: week[6], quiz_questions: [{ count: 20 }], ...base },
      { id: u(702), family_id: ids.fam, child_id: ids.minh, title: 'Toán chương 2', subject: 'Toán', status: 'published', created_by: ids.mParent, material_kind: 'exam', kind_detected: true, paper_support: true, answer_sheet_only: false, due_on: week[0] < today ? week[0] : today, quiz_questions: [{ count: 15 }], ...base },
      { id: u(703), family_id: ids.fam, child_id: ids.minh, title: 'Từ vựng tiếng Anh', subject: 'Anh', status: 'published', created_by: ids.mParent, material_kind: 'list', kind_detected: false, paper_support: false, answer_sheet_only: false, due_on: null, quiz_questions: [{ count: 12 }], ...base },
      { id: u(704), family_id: ids.fam, child_id: ids.minh, title: 'Lịch sử bài 5', subject: 'Sử', status: 'draft', created_by: ids.mParent, material_kind: 'course', kind_detected: false, paper_support: false, answer_sheet_only: false, due_on: null, quiz_questions: [{ count: 8 }], ...base },
    ],
    quiz_attempts: [
      { id: u(801), family_id: ids.fam, child_id: ids.minh, set_id: u(701), status: 'in_progress', started_at: stamp, submitted_at: null, validated_at: null, validated_by: null, relaunched_by: null, show_correction: false, quiz_results: null, quiz_sets: { title: 'Địa lý Việt Nam' }, ...base },
      { id: u(802), family_id: ids.fam, child_id: ids.minh, set_id: u(702), status: 'in_progress', started_at: stamp, submitted_at: null, validated_at: null, validated_by: null, relaunched_by: null, show_correction: false, quiz_results: null, quiz_sets: { title: 'Toán chương 2' }, ...base },
    ],
    progressCounts: [{ attempt_id: u(801), answered: 12 }, { attempt_id: u(802), answered: 7 }],
    childQuizSets: [
      { set_id: u(701), title: 'Địa lý Việt Nam', subject: 'Địa lý', question_count: 20, evaluation_attempt_id: u(801), evaluation_status: 'in_progress', can_start_evaluation: false, paper_support: false, answer_sheet_only: false, due_on: week[6], answered_count: 12 },
      { set_id: u(702), title: 'Toán chương 2', subject: 'Toán', question_count: 15, evaluation_attempt_id: null, evaluation_status: null, can_start_evaluation: true, paper_support: true, answer_sheet_only: false, due_on: week[0] < today ? week[0] : today, answered_count: 0 },
      { set_id: u(703), title: 'Từ vựng tiếng Anh', subject: 'Anh', question_count: 12, evaluation_attempt_id: null, evaluation_status: null, can_start_evaluation: true, paper_support: false, answer_sheet_only: false, due_on: null, answered_count: 0 },
    ],
    reward_requests: [], point_transactions: [], activity_log: [], notification_prefs: [], devices: [], recurrences: [], child_accounts: [], parent_invites: [],
  };
}
