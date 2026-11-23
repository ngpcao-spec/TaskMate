import { setThemeColor } from '@/pwa/themeColor';
import { bunny } from './themes/bunny';
import { cosmos } from './themes/cosmos';
import { glass } from './themes/glass';
import { kawaii } from './themes/kawaii';
import { teddy } from './themes/teddy';
import { v2 } from './themes/v2';
import type { ActiveThemeId, Theme, ThemeId } from './themes/types';
import { readStoredTheme, readStoredUiVersion, reloadApp, writeStoredTheme } from './themeStore';
import { injectV2Fonts } from './v2Fonts';

export type { ActiveThemeId, Theme, ThemeId } from './themes/types';

/** Thèmes disponibles, dans l'ordre d'affichage des réglages. */
export const THEMES: Record<ThemeId, Theme> = { glass, kawaii, cosmos, teddy, bunny };
export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
export const DEFAULT_THEME: ThemeId = 'glass';

export const isThemeId = (v: unknown): v is ThemeId => typeof v === 'string' && Object.prototype.hasOwnProperty.call(THEMES, v);

/** Valeur absente ou inconnue (ancienne version, stockage altéré) = thème par défaut, jamais d'erreur. */
export const parseThemeId = (raw: unknown): ThemeId => (isThemeId(raw) ? raw : DEFAULT_THEME);

/** Thème `v2` (D-109) : la charte de l'interface V2 pour les écrans V1 qu'elle réutilise. Jamais dans `THEMES` (jamais proposé au choix). */
export const V2_THEME = v2;

/** Thème appliqué : `v2` pour une famille en V2 (version vue au dernier lancement), sinon le thème choisi sur l'appareil. */
export function activeThemeId(storedTheme: unknown, storedUiVersion: unknown): ActiveThemeId {
  return storedUiVersion === 'v2' ? 'v2' : parseThemeId(storedTheme);
}

/** Thème actif : choisi au chargement de l'app (les styles en dépendent) ; changer de thème recharge l'app. */
const activeId = activeThemeId(readStoredTheme(), readStoredUiVersion());
export const theme: Theme = activeId === 'v2' ? V2_THEME : THEMES[activeId];

/** Web : repères pour le CSS global (police arrondie des thèmes kawaii et cosmos) et couleur de la barre du navigateur / de la PWA. */
if (typeof document !== 'undefined') {
  document.documentElement.dataset.theme = theme.id;
  if (theme.id === 'v2') injectV2Fonts();
  // D-106 : la barre d'état est translucide ; derrière elle, la couleur de fond du thème
  setThemeColor(theme.colors.background);
  document.body?.style.setProperty('background-color', theme.colors.background);
}

/** Enregistre le choix puis recharge (web) ; renvoie `manual` quand il faut fermer et rouvrir l'app (natif). */
export function switchTheme(id: ThemeId): 'reloaded' | 'manual' | 'unchanged' {
  if (id === theme.id) return 'unchanged';
  writeStoredTheme(id);
  return reloadApp();
}
