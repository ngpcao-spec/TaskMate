import { setThemeColor } from '@/pwa/themeColor';
import { v2 } from './themes/v2';
import type { Theme } from './themes/types';
import { injectV2Fonts } from './v2Fonts';

export type { ActiveThemeId, Theme, ThemeId } from './themes/types';

/**
 * Thème unique : la charte V2 (D-114 : la V1 et ses cinq thèmes au choix ont été supprimés). Les écrans communs lisent ses jetons par
 * `theme/tokens.ts` ; les écrans propres à la V2 lisent `src/v2/theme.ts` (mêmes valeurs).
 */
export const theme: Theme = v2;

/** Web : repère pour le CSS global (police Nunito) et couleur de la barre du navigateur / de la PWA. */
if (typeof document !== 'undefined') {
  document.documentElement.dataset.theme = theme.id;
  injectV2Fonts();
  // D-106 : la barre d'état est translucide ; derrière elle, la couleur de fond du thème
  setThemeColor(theme.colors.background);
  document.body?.style.setProperty('background-color', theme.colors.background);
}
