import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { useEffect } from 'react';
import { fetchMe } from '@/api/family';
import { queryKeys } from '@/api/keys';
import { supabase } from '@/api/supabase';
import { resolveEntryRoute, type EntryRoute } from '@/domain/entry-route';
import { shouldResetCache } from '@/domain/cache-owner';
import { persister } from '@/sync/persister';
import { kvStorage } from '@/sync/storage';
import { useSessionStore } from '@/store/session';

const LAST_USER_KEY = 'taskmate-last-user';

/** Branche l'état d'auth Supabase sur le store (à monter une fois, à la racine). */
export function useAuthListener(): void {
  const setSession = useSessionStore((s) => s.setSession);
  const queryClient = useQueryClient();
  useEffect(() => {
    const apply = (session: Session | null) => {
      // Un autre compte (ou une déconnexion) ne doit jamais voir le cache ni les écritures en attente du précédent.
      if (shouldResetCache(kvStorage.getItem(LAST_USER_KEY), session?.user.id ?? null)) {
        queryClient.getMutationCache().clear();
        queryClient.clear();
        void persister.removeClient();
      }
      if (session) kvStorage.setItem(LAST_USER_KEY, session.user.id);
      else kvStorage.removeItem(LAST_USER_KEY);
      setSession(session);
    };
    void supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session));
    return () => data.subscription.unsubscribe();
  }, [setSession, queryClient]);
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
    isChildAccount: session?.user.app_metadata?.account_type === 'child',
  });
}
