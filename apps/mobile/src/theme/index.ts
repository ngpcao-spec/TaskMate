import { cosmos } from './themes/cosmos';
import { glass } from './themes/glass';
import { kawaii } from './themes/kawaii';
import type { Theme, ThemeId } from './themes/types';
import { readStoredTheme, reloadApp, writeStoredTheme } from './themeStore';

export type { Theme, ThemeId } from './themes/types';

/** Thèmes disponibles, dans l'ordre d'affichage des réglages. */
export const THEMES: Record<ThemeId, Theme> = { glass, kawaii, cosmos };
export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
export const DEFAULT_THEME: ThemeId = 'glass';

export const isThemeId = (v: unknown): v is ThemeId => typeof v === 'string' && Object.prototype.hasOwnProperty.call(THEMES, v);

/** Valeur absente ou inconnue (ancienne version, stockage altéré) = thème par défaut, jamais d'erreur. */
export const parseThemeId = (raw: unknown): ThemeId => (isThemeId(raw) ? raw : DEFAULT_THEME);

/** Thème actif : choisi au chargement de l'app (les styles en dépendent) ; changer de thème recharge l'app. */
export const theme: Theme = THEMES[parseThemeId(readStoredTheme())];

/** Web : repères pour le CSS global (police arrondie des thèmes kawaii et cosmos) et couleur de la barre du navigateur / de la PWA. */
if (typeof document !== 'undefined') {
  document.documentElement.dataset.theme = theme.id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.browserColor);
  document.body?.style.setProperty('background-color', theme.colors.background);
}

/** Enregistre le choix puis recharge (web) ; renvoie `manual` quand il faut fermer et rouvrir l'app (natif). */
export function switchTheme(id: ThemeId): 'reloaded' | 'manual' | 'unchanged' {
  if (id === theme.id) return 'unchanged';
  writeStoredTheme(id);
  return reloadApp();
}
