-- W3 — Web Push : un appareil « web » porte un abonnement push standard (endpoint + clés), enregistré par RPC.
-- Aucune nouvelle table : `devices` garde sa RLS (select seul ; écriture par RPC, cf. migration 1).

alter table public.devices drop constraint devices_platform_check;
alter table public.devices add constraint devices_platform_check check (platform in ('ios', 'android', 'web'));
alter table public.devices add column web_push_subscription jsonb;
alter table public.devices add constraint devices_web_push_shape check (
  web_push_subscription is null or (
    platform = 'web'
    and jsonb_typeof(web_push_subscription) = 'object'
    and coalesce(web_push_subscription->>'endpoint', '') like 'https://%'
    and coalesce(web_push_subscription->'keys'->>'p256dh', '') <> ''
    and coalesce(web_push_subscription->'keys'->>'auth', '') <> ''
  )
);
-- un navigateur (endpoint) = au plus un appareil actif
create unique index devices_web_push_endpoint on public.devices ((web_push_subscription->>'endpoint'))
  where web_push_subscription is not null and revoked_at is null;

create function public.register_web_push(p_subscription jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare me public.members; did uuid; ep text;
begin
  me := public.require_member();
  ep := p_subscription->>'endpoint';
  if ep is null or ep not like 'https://%' then raise exception 'invalid_subscription' using errcode = 'P0001'; end if;
  -- le navigateur change de compte : l'ancien abonnement ne doit plus recevoir les notifications de l'autre membre
  update public.devices set revoked_at = now()
  where web_push_subscription->>'endpoint' = ep and member_id <> me.id and revoked_at is null;
  select id into did from public.devices
  where member_id = me.id and web_push_subscription->>'endpoint' = ep and revoked_at is null;
  if found then
    update public.devices set web_push_subscription = p_subscription, last_seen_at = now() where id = did;
  else
    insert into public.devices (member_id, platform, web_push_subscription) values (me.id, 'web', p_subscription)
    returning id into did;
  end if;
  return did;
end $$;

create function public.unregister_web_push(p_endpoint text) returns void
language plpgsql security definer set search_path = public as $$
declare me public.members;
begin
  me := public.require_member();
  update public.devices set revoked_at = now(), web_push_subscription = null
  where member_id = me.id and web_push_subscription->>'endpoint' = p_endpoint and revoked_at is null;
end $$;

revoke all on function public.register_web_push(jsonb), public.unregister_web_push(text) from public, anon;
grant execute on function public.register_web_push(jsonb), public.unregister_web_push(text) to authenticated;
