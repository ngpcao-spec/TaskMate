import { Asset } from 'expo-asset';
import { HOME_VIDEO_SOURCES } from './video';

/** Web : télécharge l'image d'aperçu de la vidéo d'accueil dès l'ouverture de la V2, pour qu'elle s'affiche aussitôt dans Hôm nay (D-106). */
export function preloadHomePoster(): void {
  try {
    const img = new Image();
    img.src = Asset.fromModule(HOME_VIDEO_SOURCES.poster as number).uri;
  } catch {
    // rien : l'image se chargera avec la page
  }
}
