import { encodeResume, RESUME_KEY } from '@/domain/resume-path';

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

/** Web : un rechargement applique le nouveau thème partout (les styles sont calculés au chargement des modules). La page courante est mémorisée avant : la PWA iPhone repart sinon de la page de départ (D-103). */
export const reloadApp = (): 'reloaded' | 'manual' => {
  try {
    try {
      globalThis.localStorage?.setItem(RESUME_KEY, encodeResume(globalThis.location.pathname + globalThis.location.search, Date.now()));
    } catch {
      // stockage indisponible : le rechargement a lieu quand même
    }
    globalThis.location.reload();
    return 'reloaded';
  } catch {
    return 'manual';
  }
};

/** Version d'interface de la famille vue au dernier lancement (D-106 : `useUiVersionSwitch` l'écrit) : en V2, le thème `v2` est imposé (D-109). */
export const UI_VERSION_KEY = 'taskmate-ui-version';
export const readStoredUiVersion = (): string | null => {
  try {
    return globalThis.localStorage?.getItem(UI_VERSION_KEY) ?? null;
  } catch {
    return null;
  }
};

/** Recharge la page (le thème est calculé au chargement des modules), à `path` s'il est donné ; `false` si impossible. */
export const reloadCurrent = (path?: string): boolean => {
  try {
    if (path) globalThis.location.replace(path);
    else globalThis.location.reload();
    return true;
  } catch {
    return false;
  }
};
