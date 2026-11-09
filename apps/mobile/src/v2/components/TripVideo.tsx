import type { TripVideoEntry } from '../video';

export type TripVideoProps = {
  /** vidéo de voyage du stade affiché (`tripVideoForStage`) */
  video: TripVideoEntry;
  /** `video` : boucle ; `still` : aperçu fixe seulement (« réduire les animations ») */
  mode: 'video' | 'still';
  /** Hôm nay a le focus (sinon pause) */
  active: boolean;
  /** lecture refusée par le navigateur ou aucune source lisible : l'écran revient à la maison vide + mot (D-107) */
  onFailed: () => void;
  topClear: number;
  groundOffset: number;
  /** taille de l'en-tête (largeur de l'écran, hauteur + marge haute), connue d'avance */
  width: number;
  height: number;
};

/** Natif (iOS / Android) : pas de vidéo de voyage (aucune nouvelle dépendance native) ; l'écran garde la maison vide + mot (D-107). */
export function TripVideo(_props: TripVideoProps): null {
  return null;
}
