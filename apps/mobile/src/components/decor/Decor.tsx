import { Astronaut, CosmosOrnamentRow, StarShape } from '@/components/decor/art-cosmos';
import { Paw, TeddyFace, TeddyOrnamentRow } from '@/components/decor/art-teddy';
import { DogFace, OrnamentRow, Sparkle } from '@/components/decor/art';
import { decor } from '@/theme/tokens';

/**
 * Décors du thème actif, choisis par FAMILLE (`decor`) : un seul endroit à compléter pour ajouter un thème illustré. Rien n'est rendu avec `decor === 'none'`
 * (les écrans testent `hasDecor` avant d'ajouter la mise en page qui accompagne le décor).
 */

/** Mascotte : petit chien (kawaii), astronaute (cosmos) ou ourson (teddy). */
export function Mascot({ size, happy = false }: { size: number; happy?: boolean }) {
  if (decor === 'cosmos') return <Astronaut size={size} happy={happy} />;
  if (decor === 'teddy') return <TeddyFace size={size} happy={happy} />;
  if (decor === 'kawaii') return <DogFace size={size} happy={happy} />;
  return null;
}

/** Ligne d'ornements du haut de l'accueil. */
export function TopOrnament() {
  if (decor === 'cosmos') return <CosmosOrnamentRow />;
  if (decor === 'teddy') return <TeddyOrnamentRow />;
  if (decor === 'kawaii') return <OrnamentRow />;
  return null;
}

/** Petit repère devant un titre de section. */
export function SectionMark({ size = 24 }: { size?: number }) {
  if (decor === 'cosmos') return <StarShape size={size} />;
  if (decor === 'teddy') return <Paw size={size} />;
  if (decor === 'kawaii') return <Sparkle size={size} />;
  return null;
}
