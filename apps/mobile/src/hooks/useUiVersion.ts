import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { queryKeys } from '@/api/keys';
import { parseUiVersion, uiVersionChanged, type UiVersion } from '@/domain/ui-version';
import { useMe } from '@/hooks/useMe';
import { persister } from '@/sync/persister';
import { kvStorage } from '@/sync/storage';

const UI_VERSION_KEY = 'taskmate-ui-version';

/** Interface de la famille du compte connecté (D-106) ; V1 tant qu'elle n'est pas lue. */
export const useUiVersion = (): UiVersion => parseUiVersion(useMe().data?.family.ui_version);

/**
 * À monter une fois, à la racine. Quand la version d'interface de la famille change (l'administrateur l'a basculée), le cache persisté est purgé
 * (les écritures en attente sont gardées : elles appartiennent au même compte) et l'accueil est rouvert, dans la bonne interface.
 */
export function useUiVersionSwitch(): void {
  const me = useMe().data;
  const queryClient = useQueryClient();
  const router = useRouter();
  const version = me ? parseUiVersion(me.family.ui_version) : null;
  useEffect(() => {
    if (version === null) return;
    const stored = kvStorage.getItem(UI_VERSION_KEY);
    kvStorage.setItem(UI_VERSION_KEY, version);
    if (!uiVersionChanged(stored, version)) return;
    void persister.removeClient();
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== queryKeys.me[0] });
    router.replace('/');
  }, [version, queryClient, router]);
}
