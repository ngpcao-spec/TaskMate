import { colors } from '@/theme/tokens';
import { Gradient } from './Gradient';

/** Fond d'écran acier bleuté (dégradé doux), à placer en premier enfant d'un conteneur `flex: 1`. */
export function Backdrop() {
  return <Gradient from={colors.backgroundTop} to={colors.backgroundBottom} direction="d" />;
}
