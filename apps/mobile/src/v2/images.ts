import type { ImageSourcePropType } from 'react-native';
import type { GoalIcon } from '@/domain/goal-icons';
import type { PandaStage } from '@/domain/panda';

/**
 * Images de l'interface V2 (D-106) : décors, icônes d'objectifs, carte des aventures, panda en marche. TOUS les `require` de ces images sont ICI
 * (statiques, comme l'exige Metro) : jamais de `require` dans un écran. Les poses et expressions du panda restent dans
 * `components/companion/pandaImages.ts`, les cartes postales et trouvailles dans `components/adventure/adventureImages.ts`.
 * Images fournies (branche `assets/v2-scenes`), jamais régénérées ni modifiées.
 */
export type ImageSize = 'full' | 'small';
type Pair = { full: ImageSourcePropType; small: ImageSourcePropType };

/** Décors 1086×1448 (`small` = 720 px) : ciel en haut, sol libre au centre pour le panda. */
export const SCENE_SLUGS = ['home', 'ha-long', 'hoi-an', 'mekong', 'da-lat', 'sa-pa', 'phong-nha'] as const;
export type SceneSlug = (typeof SCENE_SLUGS)[number];
export const SCENE_RATIO = 1448 / 1086;
const SCENES: Record<SceneSlug, Pair> = {
  'home': { full: require('../../assets/v2/scenes/scene-home.webp'), small: require('../../assets/v2/scenes/scene-home@720.webp') },
  'ha-long': { full: require('../../assets/v2/scenes/scene-ha-long.webp'), small: require('../../assets/v2/scenes/scene-ha-long@720.webp') },
  'hoi-an': { full: require('../../assets/v2/scenes/scene-hoi-an.webp'), small: require('../../assets/v2/scenes/scene-hoi-an@720.webp') },
  'mekong': { full: require('../../assets/v2/scenes/scene-mekong.webp'), small: require('../../assets/v2/scenes/scene-mekong@720.webp') },
  'da-lat': { full: require('../../assets/v2/scenes/scene-da-lat.webp'), small: require('../../assets/v2/scenes/scene-da-lat@720.webp') },
  'sa-pa': { full: require('../../assets/v2/scenes/scene-sa-pa.webp'), small: require('../../assets/v2/scenes/scene-sa-pa@720.webp') },
  'phong-nha': { full: require('../../assets/v2/scenes/scene-phong-nha.webp'), small: require('../../assets/v2/scenes/scene-phong-nha@720.webp') },
};

export const isSceneSlug = (v: unknown): v is SceneSlug => typeof v === 'string' && (SCENE_SLUGS as readonly string[]).includes(v);
/** Décor : celui de la destination s'il existe, sinon la bambouseraie (`home`). */
export const sceneImage = (slug: string | null | undefined, size: ImageSize = 'small'): ImageSourcePropType => SCENES[isSceneSlug(slug) ? slug : 'home'][size];

/** Icônes d'objectifs, 192 px, fond transparent. */
const GOALS: Record<GoalIcon, ImageSourcePropType> = {
  'reveil': require('../../assets/v2/goals/goal-reveil.webp'),
  'brosse-a-dents': require('../../assets/v2/goals/goal-brosse-a-dents.webp'),
  'savon': require('../../assets/v2/goals/goal-savon.webp'),
  'douche': require('../../assets/v2/goals/goal-douche.webp'),
  'vetements': require('../../assets/v2/goals/goal-vetements.webp'),
  'lit': require('../../assets/v2/goals/goal-lit.webp'),
  'petit-dejeuner': require('../../assets/v2/goals/goal-petit-dejeuner.webp'),
  'boite-repas': require('../../assets/v2/goals/goal-boite-repas.webp'),
  'diner': require('../../assets/v2/goals/goal-diner.webp'),
  'verre-eau': require('../../assets/v2/goals/goal-verre-eau.webp'),
  'fruits': require('../../assets/v2/goals/goal-fruits.webp'),
  'cartable': require('../../assets/v2/goals/goal-cartable.webp'),
  'devoirs': require('../../assets/v2/goals/goal-devoirs.webp'),
  'lecture': require('../../assets/v2/goals/goal-lecture.webp'),
  'ecriture': require('../../assets/v2/goals/goal-ecriture.webp'),
  'maths': require('../../assets/v2/goals/goal-maths.webp'),
  'langues': require('../../assets/v2/goals/goal-langues.webp'),
  'dessin': require('../../assets/v2/goals/goal-dessin.webp'),
  'piano': require('../../assets/v2/goals/goal-piano.webp'),
  'football': require('../../assets/v2/goals/goal-football.webp'),
  'natation': require('../../assets/v2/goals/goal-natation.webp'),
  'velo': require('../../assets/v2/goals/goal-velo.webp'),
  'course': require('../../assets/v2/goals/goal-course.webp'),
  'yoga': require('../../assets/v2/goals/goal-yoga.webp'),
  'ranger': require('../../assets/v2/goals/goal-ranger.webp'),
  'vaisselle': require('../../assets/v2/goals/goal-vaisselle.webp'),
  'linge': require('../../assets/v2/goals/goal-linge.webp'),
  'poubelle': require('../../assets/v2/goals/goal-poubelle.webp'),
  'arroser': require('../../assets/v2/goals/goal-arroser.webp'),
  'animal': require('../../assets/v2/goals/goal-animal.webp'),
  'cuisiner': require('../../assets/v2/goals/goal-cuisiner.webp'),
  'appeler': require('../../assets/v2/goals/goal-appeler.webp'),
  'gentillesse': require('../../assets/v2/goals/goal-gentillesse.webp'),
  'dormir-tot': require('../../assets/v2/goals/goal-dormir-tot.webp'),
  'sans-ecran': require('../../assets/v2/goals/goal-sans-ecran.webp'),
  'calme': require('../../assets/v2/goals/goal-calme.webp'),
};
export const goalIconImage = (icon: GoalIcon): ImageSourcePropType => GOALS[icon];

/** Carte des aventures 1086×1448 (`small` = 720 px). */
export const MAP_RATIO = 1448 / 1086;
const MAP: Pair = { full: require('../../assets/v2/map/map-vietnam.webp'), small: require('../../assets/v2/map/map-vietnam@720.webp') };
export const mapImage = (size: ImageSize = 'small'): ImageSourcePropType => MAP[size];

/** Centre de chaque clairière, en fraction de l'image (x, y) : SEULE source des positions des repères et cadenas. */
export type MapSpot = { x: number; y: number };
const SPOTS: Record<string, unknown> = require('../../assets/v2/map/map-spots.json');
export function mapSpot(destination: string): MapSpot | null {
  const s = SPOTS[destination] as Partial<MapSpot> | undefined;
  return s && typeof s.x === 'number' && typeof s.y === 'number' && destination !== '_doc' ? { x: s.x, y: s.y } : null;
}

/** Panda en marche vers la DROITE, sac à dos (768 px ; `small` = 384 px). Vers la gauche : retourner l'image (scaleX −1). */
const WALK: Record<PandaStage, Pair> = {
  1: { full: require('../../assets/v2/walk/panda-walk-age-1-be.webp'), small: require('../../assets/v2/walk/panda-walk-age-1-be@384.webp') },
  2: { full: require('../../assets/v2/walk/panda-walk-age-2-nhi.webp'), small: require('../../assets/v2/walk/panda-walk-age-2-nhi@384.webp') },
  3: { full: require('../../assets/v2/walk/panda-walk-age-3-teen.webp'), small: require('../../assets/v2/walk/panda-walk-age-3-teen@384.webp') },
  4: { full: require('../../assets/v2/walk/panda-walk-age-4-dong-hanh.webp'), small: require('../../assets/v2/walk/panda-walk-age-4-dong-hanh@384.webp') },
};
export const pandaWalkImage = (stage: PandaStage, size: ImageSize = 'small'): ImageSourcePropType => WALK[stage][size];

/**
 * Voyage du panda (D-107, branche `assets/v2-trip`, 512 px, fond transparent) : paquet fermé et ouvert, mot épinglé, maison du panda sur la carte.
 */
export type TripImage = 'gift-closed' | 'gift-open' | 'note' | 'home-marker';
const TRIP: Record<TripImage, ImageSourcePropType> = {
  'gift-closed': require('../../assets/v2/trip/gift-closed.webp'),
  'gift-open': require('../../assets/v2/trip/gift-open.webp'),
  'note': require('../../assets/v2/trip/note.webp'),
  'home-marker': require('../../assets/v2/trip/home-marker.webp'),
};
export const tripImage = (name: TripImage): ImageSourcePropType => TRIP[name];

/** Porte de la maison dans le décor `home` (fraction de l'image, mesurée sur `scene-home@720.webp`) : le mot du voyage y est épinglé. */
export const HOME_DOOR: MapSpot = { x: 0.75, y: 0.39 };
