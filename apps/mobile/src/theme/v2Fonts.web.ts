import { Asset } from 'expo-asset';
import { V2_FONT_FILES } from '@/v2/theme';

const STYLE_ID = 'taskmate-v2-fonts';
const uri = (mod: unknown): string => {
  try {
    return Asset.fromModule(mod as number).uri;
  } catch {
    return '';
  }
};

/**
 * Web, thème `v2` (D-109) : les écrans V1 réutilisés par la V2 prennent la police de la V2. Une famille « NunitoV2 » regroupe les fichiers Nunito
 * déjà embarqués (600, 700, 800, 700 italique) par graisse ; `html[data-theme='v2']` l'applique à tout le texte (index.html). Les écrans V2, qui
 * nomment déjà Nunito, ne changent pas : même police, même graisse. Une seule fois.
 */
export function injectV2Fonts(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const faces: [unknown, number, 'normal' | 'italic'][] = [
    [V2_FONT_FILES.Nunito_600SemiBold, 600, 'normal'],
    [V2_FONT_FILES.Nunito_700Bold, 700, 'normal'],
    [V2_FONT_FILES.Nunito_800ExtraBold, 800, 'normal'],
    [V2_FONT_FILES.Nunito_700Bold_Italic, 700, 'italic'],
  ];
  const css = faces
    .map(([mod, weight, style]) => {
      const src = uri(mod);
      return src ? `@font-face{font-family:'NunitoV2';src:url('${src}') format('truetype');font-weight:${weight};font-style:${style};font-display:swap;}` : '';
    })
    .join('');
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = css;
  document.head.appendChild(el);
}
