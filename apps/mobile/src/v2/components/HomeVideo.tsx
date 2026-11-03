import type { PandaAnim } from '@/domain/panda-animation';
import type { HomeVideoEntry, HomeVideoSources } from '../video';

/** Vidéo à afficher : le repos du stade (en boucle) ou une réaction (une seule lecture). `serial` relance la même réaction. */
export type HomeClip = { name: PandaAnim; key: string; sources: HomeVideoSources; loop: boolean; serial: number };

/** Natif (iOS / Android) : pas de vidéo d'accueil pour l'instant (aucune nouvelle dépendance native) — décor fixe + `PandaSprite` (D-106). */
export type HomeVideoProps = {
  /** vidéo de repos du stade affiché (`homeVideoForStage`) : sources et géométrie du panda (les réactions ont la même) */
  video: HomeVideoEntry;
  /** vidéo demandée par le gestionnaire d'animations (`usePandaAnimation`) ; absente = repos */
  clip?: HomeClip | null;
  /** image fixe à montrer À LA PLACE de toute vidéo (panda endormi après le coucher) */
  still?: unknown;
  /** réactions à préparer légèrement (`preload="metadata"`) une fois le repos lancé */
  prefetch?: HomeVideoSources[];
  onStarted?: (name: PandaAnim) => void;
  /** fin RÉELLE (`ended`) d'une réaction */
  onEnded?: (name: PandaAnim) => void;
  /** réaction pas prête à temps (1,5 s), lecture refusée ou fichier absent */
  onFailed?: (name: PandaAnim) => void;
  visible: boolean;
  active: boolean;
  topClear: number;
  groundOffset: number;
  /** taille de l'en-tête (largeur de l'écran, hauteur + marge haute) : connue d'avance, la vidéo n'attend aucune mesure */
  width: number;
  height: number;
};
export function HomeVideo(_props: HomeVideoProps): null {
  return null;
}
