import { Asset } from 'expo-asset';
import { HOME_VIDEOS } from './video';

/** Web : télécharge les images d'aperçu des vidéos d'accueil (une par stade, ~60 Ko) dès l'ouverture de la V2, pour qu'elles s'affichent aussitôt (D-106). */
export function preloadHomePoster(): void {
  for (const entry of Object.values(HOME_VIDEOS)) {
    try {
      const img = new Image();
      img.src = Asset.fromModule(entry!.sources.poster as number).uri;
    } catch {
      // rien : l'image se chargera avec la page
    }
  }
}
