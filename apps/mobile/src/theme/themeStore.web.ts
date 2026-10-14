/** Thème choisi sur CET appareil (web / PWA) : `localStorage`, lu de façon synchrone au chargement des jetons. */
export const THEME_KEY = 'taskmate-theme';

export const readStoredTheme = (): string | null => {
  try {
    return globalThis.localStorage?.getItem(THEME_KEY) ?? null;
  } catch {
    return null; // stockage bloqué (navigation privée stricte) : thème par défaut
  }
};

export const writeStoredTheme = (id: string): void => {
  try {
    globalThis.localStorage?.setItem(THEME_KEY, id);
  } catch {
    // stockage indisponible : le choix vaut pour cette session seulement
  }
};

/** Web : un rechargement applique le nouveau thème partout (les styles sont calculés au chargement des modules). */
export const reloadApp = (): 'reloaded' | 'manual' => {
  try {
    globalThis.location.reload();
    return 'reloaded';
  } catch {
    return 'manual';
  }
};
