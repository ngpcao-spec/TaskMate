import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { queryKeys } from '@/api/keys';
import { parseUiVersion, themeMatchesUi, uiVersionChanged, type UiVersion } from '@/domain/ui-version';
import { useMe } from '@/hooks/useMe';
import { persister } from '@/sync/persister';
import { kvStorage } from '@/sync/storage';
import { themeId } from '@/theme/tokens';
import { reloadCurrent, UI_VERSION_KEY } from '@/theme/themeStore';

/** Interface de la famille du compte connecté (D-106) ; V2 tant qu'elle n'est pas lue (D-114). */
export const useUiVersion = (): UiVersion => parseUiVersion(useMe().data?.family.ui_version);

/**
 * À monter une fois, à la racine. Quand la version d'interface de la famille change (l'administrateur l'a basculée), le cache persisté est purgé
 * (les écritures en attente sont gardées : elles appartiennent au même compte) et l'accueil est rouvert, dans la bonne interface.
 * D-109 : le thème `v2` (écrans V1 réutilisés par la V2) est choisi au CHARGEMENT d'après la version enregistrée ici ; s'il ne correspond pas à la
 * famille (premier lancement sur l'appareil, bascule, autre compte), la page est rechargée une fois (web ; natif : au prochain lancement).
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
    const changed = uiVersionChanged(stored, version);
    if (changed) {
      void persister.removeClient();
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== queryKeys.me[0] });
    }
    // thème du chargement ≠ interface de la famille : rechargement (à l'accueil si la version vient de changer)
    if (!themeMatchesUi(themeId, version) && reloadCurrent(changed ? '/' : undefined)) return;
    if (changed) router.replace('/');
  }, [version, queryClient, router]);
}
