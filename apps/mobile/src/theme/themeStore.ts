import { kvStorage } from '@/sync/storage';

/** Thème choisi sur CET appareil (natif) : MMKV, lu de façon SYNCHRONE au chargement des jetons. */
export const THEME_KEY = 'taskmate-theme';

export const readStoredTheme = (): string | null => {
  try {
    return kvStorage.getItem(THEME_KEY);
  } catch {
    return null; // stockage illisible : thème par défaut
  }
};

export const writeStoredTheme = (id: string): void => {
  try {
    kvStorage.setItem(THEME_KEY, id);
  } catch {
    // stockage indisponible : le choix vaut pour cette session seulement
  }
};

/** Natif : pas de rechargement programmable sans module dédié ; l'écran des réglages demande de rouvrir l'app. */
export const reloadApp = (): 'reloaded' | 'manual' => 'manual';

/** Version d'interface de la famille vue au dernier lancement (D-106 : `useUiVersionSwitch` l'écrit) : en V2, le thème `v2` est imposé (D-109). */
export const UI_VERSION_KEY = 'taskmate-ui-version';
export const readStoredUiVersion = (): string | null => {
  try {
    return kvStorage.getItem(UI_VERSION_KEY);
  } catch {
    return null;
  }
};

/** Natif : pas de rechargement programmable ; le thème V2 s'applique au prochain lancement. */
export const reloadCurrent = (_path?: string): boolean => false;
