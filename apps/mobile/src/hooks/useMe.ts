import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { fetchMe } from '@/api/family';
import { queryKeys } from '@/api/keys';
import { supabase } from '@/api/supabase';
import { resolveEntryRoute, type EntryRoute } from '@/domain/entry-route';
import { useSessionStore } from '@/store/session';

/** Branche l'état d'auth Supabase sur le store (à monter une fois, à la racine). */
export function useAuthListener(): void {
  const setSession = useSessionStore((s) => s.setSession);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => data.subscription.unsubscribe();
  }, [setSession]);
}

export function useMe() {
  const userId = useSessionStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: [...queryKeys.me, userId],
    queryFn: () => fetchMe(userId as string),
    enabled: userId !== null,
  });
}

export function useEntryRoute(): EntryRoute {
  const { authReady, session } = useSessionStore();
  const me = useMe();
  return resolveEntryRoute({
    authReady,
    hasSession: session !== null,
    memberLoaded: !me.isPending,
    member: me.data ? { role: me.data.member.role } : null,
    childrenCount: me.data?.children.length ?? 0,
  });
}
