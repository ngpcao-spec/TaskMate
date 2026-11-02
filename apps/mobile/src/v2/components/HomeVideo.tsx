/** Natif (iOS / Android) : pas de vidéo d'accueil pour l'instant (aucune nouvelle dépendance native) — décor fixe + `PandaSprite` (D-106). */
export type HomeVideoProps = {
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
