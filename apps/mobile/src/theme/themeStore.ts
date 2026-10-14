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
