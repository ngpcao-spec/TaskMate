-- D-063 — Langue des notifications push : chaque appareil porte la langue choisie dans l'app (vi par défaut, SPEC §3.9).
-- Aucune table nouvelle : `devices` garde sa RLS (select seul ; écriture par RPC, cf. migration 1).

alter table public.devices add column locale text not null default 'vi';
alter table public.devices add constraint devices_locale_check check (locale in ('vi', 'fr', 'en'));

-- Applique la langue à TOUS les appareils actifs du membre appelant (un membre = une personne ; sur deux appareils
-- réglés dans deux langues, le dernier réglage l'emporte). Idempotente ; aucune écriture directe sur `devices`.
create function public.set_push_locale(p_locale text) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members;
begin
  me := public.require_member();
  if p_locale is null or p_locale not in ('vi', 'fr', 'en') then raise exception 'invalid_locale' using errcode = 'P0001'; end if;
  update public.devices set locale = p_locale where member_id = me.id and revoked_at is null and locale <> p_locale;
end $$;

revoke all on function public.set_push_locale(text) from public, anon;
grant execute on function public.set_push_locale(text) to authenticated;
