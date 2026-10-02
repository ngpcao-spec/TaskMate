-- M11 — Suppression du compte et des données (SPEC §3.9 ; exigence App Store / Play Store pour des données de mineurs).
-- Le journal des points reste immuable pour les clients ; seule la suppression de TOUTE la famille le purge
-- (drapeau local à la transaction, posé uniquement par la fonction ci-dessous).

create or replace function public.forbid_mutation() returns trigger
language plpgsql as $$
begin
  -- DELETE autorisé uniquement pendant delete_family() ; UPDATE et TRUNCATE restent toujours interdits.
  if tg_op = 'DELETE' and current_setting('app.deleting_family', true) = 'on' then
    return old;
  end if;
  raise exception 'immutable_journal' using errcode = '42501';
end $$;

-- Renvoie les user_id (auth.users) des membres supprimés : l'Edge Function `delete-account` supprime ensuite
-- ces comptes avec la clé service (impossible depuis SQL côté client).
create function public.delete_family() returns uuid[]
language plpgsql security definer set search_path = public as $$
declare me public.members; fid uuid; users uuid[];
begin
  me := public.require_member();
  if me.role <> 'parent' then raise exception 'forbidden' using errcode = '42501'; end if;
  fid := me.family_id;
  select coalesce(array_agg(user_id), '{}') into users from public.members where family_id = fid;

  perform set_config('app.deleting_family', 'on', true);
  delete from public.activity_log where family_id = fid;
  delete from public.reward_requests where family_id = fid;
  delete from public.point_transactions where family_id = fid;
  delete from public.notification_prefs where member_id in (select id from public.members where family_id = fid);
  delete from public.devices where member_id in (select id from public.members where family_id = fid);
  delete from public.invite_codes where family_id = fid;
  delete from public.tasks where family_id = fid;
  delete from public.recurrences where family_id = fid;
  delete from public.goals where family_id = fid;
  delete from public.rewards where family_id = fid;
  delete from public.members where family_id = fid;
  delete from public.children where family_id = fid;
  delete from public.families where id = fid;
  perform set_config('app.deleting_family', 'off', true);
  return users;
end $$;
revoke all on function public.delete_family() from public, anon;
grant execute on function public.delete_family() to authenticated;
