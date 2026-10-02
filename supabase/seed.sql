-- Famille de démo : Minh (17 ans) et Khang (13 ans). Données de développement uniquement.
-- Comptes : parent@taskmate.test (OTP via Inbucket local) ; les enfants rejoignent via code d'invitation.
insert into auth.users (id, email, aud, role, instance_id, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-00000000d001', 'parent@taskmate.test', 'authenticated', 'authenticated',
        '00000000-0000-0000-0000-000000000000', now(), now(), now(), '{"provider":"email"}', '{}')
on conflict (id) do nothing;

insert into public.families (id, name) values ('00000000-0000-0000-0000-00000000f001', 'Gia đình demo')
on conflict (id) do nothing;
insert into public.members (id, family_id, user_id, role, display_name) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000f001',
   '00000000-0000-0000-0000-00000000d001', 'parent', 'Ba')
on conflict (id) do nothing;
insert into public.children (id, family_id, name, birth_date, color, label, sort_order) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000f001', 'Minh',
   (current_date - interval '17 years 2 months')::date, '#1E88F5', 'Con trai lớn', 1),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000f001', 'Khang',
   (current_date - interval '13 years 4 months')::date, '#2EC4A6', 'Con trai út', 2)
on conflict (id) do nothing;
insert into public.rewards (family_id, title, icon, cost, sort_order) values
  ('00000000-0000-0000-0000-00000000f001', 'Chơi game 1 tiếng', 'gamepad-2', 100, 1),
  ('00000000-0000-0000-0000-00000000f001', 'Xem phim yêu thích', 'film', 150, 2),
  ('00000000-0000-0000-0000-00000000f001', 'Dùng điện thoại thêm 30 phút', 'smartphone', 200, 3),
  ('00000000-0000-0000-0000-00000000f001', 'Đồ ăn vặt', 'cookie', 100, 4);
insert into public.tasks (family_id, child_id, title, category, date, time_kind, start_time, end_time, created_by) values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000c001', 'Làm bài tập Toán', 'study', current_date, 'range', '08:00', '08:45', '00000000-0000-0000-0000-00000000a001'),
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000c001', 'Tập thể dục', 'sport', current_date, 'range', '17:00', '17:30', '00000000-0000-0000-0000-00000000a001'),
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000c002', 'Dọn phòng', 'chores', current_date, 'deadline', null, '21:00', '00000000-0000-0000-0000-00000000a001');
