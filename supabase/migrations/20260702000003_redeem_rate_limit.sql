-- M2 — limite de tentatives sur redeem_invite (SPEC §5.8, D-011).
create table public.redeem_attempts (
  id bigint generated always as identity primary key,
  key text not null,
  created_at timestamptz not null default now()
);
create index redeem_attempts_key_created on public.redeem_attempts (key, created_at);
alter table public.redeem_attempts enable row level security;
revoke all on public.redeem_attempts from anon, authenticated;
-- aucune policy : table interne, uniquement accessible aux fonctions security definer.

drop function public.redeem_invite(text, text);
-- Renvoie l'id du membre créé, ou NULL si le code est invalide (l'échec est journalisé).
create function public.redeem_invite(p_code text, p_display_name text default null, p_extra_key text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv public.invite_codes; mid uuid; cname text; k_user text := 'u:' || auth.uid()::text; fails int;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if exists (select 1 from public.members
             where user_id = auth.uid() and revoked_at is null and deleted_at is null) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;

  select coalesce(max(n), 0) into fails from (
    select count(*) as n from public.redeem_attempts
    where created_at > now() - interval '15 minutes' and key in (k_user, 'i:' || p_extra_key)
    group by key) per_key;
  if fails >= 5 then raise exception 'too_many_attempts' using errcode = 'P0001'; end if;

  select * into inv from public.invite_codes
  where code = upper(btrim(p_code)) and used_at is null and revoked_at is null and expires_at > now()
  for update;
  if not found then
    insert into public.redeem_attempts (key) values (k_user);
    if p_extra_key is not null then insert into public.redeem_attempts (key) values ('i:' || p_extra_key); end if;
    return null;
  end if;

  -- l'enfant prend le prénom de son profil par défaut ; un co-parent doit fournir son nom
  select name into cname from public.children where id = inv.child_id;
  insert into public.members (family_id, user_id, role, child_id, display_name)
  values (inv.family_id, auth.uid(), inv.role, inv.child_id,
          coalesce(nullif(btrim(p_display_name), ''), cname, 'Parent')) returning id into mid;
  update public.invite_codes set used_at = now() where id = inv.id;
  return mid;
end $$;
revoke all on function public.redeem_invite(text, text, text) from public, anon;
grant execute on function public.redeem_invite(text, text, text) to authenticated;
