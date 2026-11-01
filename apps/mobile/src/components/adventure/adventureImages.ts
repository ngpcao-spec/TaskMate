import type { ImageSourcePropType } from 'react-native';

/**
 * Images des aventures du panda (D-105) : images générées par IA pour TaskMate, retouchées ; aucune image de tiers.
 * TOUS les `require` sont ici (statiques, comme l'exige Metro) : jamais de `require` d'image dans un écran.
 * Cartes postales ~480×430 px (coins arrondis, fond transparent) : ne jamais les afficher à plus de `POSTCARD_MAX_WIDTH`.
 * Trouvailles 256×256 px, fond transparent.
 */
export const POSTCARD_MAX_WIDTH = 360;
/** Proportions d'une carte postale (hauteur / largeur). */
export const POSTCARD_RATIO = 430 / 480;

const DESTINATIONS: Record<string, ImageSourcePropType> = {
  'ha-long': require('../../../assets/adventures/destinations/ha-long.webp'),
  'hoi-an': require('../../../assets/adventures/destinations/hoi-an.webp'),
  'mekong': require('../../../assets/adventures/destinations/mekong.webp'),
  'da-lat': require('../../../assets/adventures/destinations/da-lat.webp'),
  'sa-pa': require('../../../assets/adventures/destinations/sa-pa.webp'),
  'phong-nha': require('../../../assets/adventures/destinations/phong-nha.webp'),
};

const DISCOVERIES: Record<string, ImageSourcePropType> = {
  'da-lat-confiture': require('../../../assets/adventures/discoveries/da-lat-confiture.webp'),
  'da-lat-da-quy': require('../../../assets/adventures/discoveries/da-lat-da-quy.webp'),
  'da-lat-fraise': require('../../../assets/adventures/discoveries/da-lat-fraise.webp'),
  'da-lat-pomme-de-pin': require('../../../assets/adventures/discoveries/da-lat-pomme-de-pin.webp'),
  'da-lat-velo': require('../../../assets/adventures/discoveries/da-lat-velo.webp'),
  'ha-long-coquillage': require('../../../assets/adventures/discoveries/ha-long-coquillage.webp'),
  'ha-long-etoile-de-mer': require('../../../assets/adventures/discoveries/ha-long-etoile-de-mer.webp'),
  'ha-long-flotteur': require('../../../assets/adventures/discoveries/ha-long-flotteur.webp'),
  'ha-long-jonque': require('../../../assets/adventures/discoveries/ha-long-jonque.webp'),
  'ha-long-perle': require('../../../assets/adventures/discoveries/ha-long-perle.webp'),
  'ha-long-rocher': require('../../../assets/adventures/discoveries/ha-long-rocher.webp'),
  'hoi-an-banh-mi': require('../../../assets/adventures/discoveries/hoi-an-banh-mi.webp'),
  'hoi-an-barque': require('../../../assets/adventures/discoveries/hoi-an-barque.webp'),
  'hoi-an-eventail': require('../../../assets/adventures/discoveries/hoi-an-eventail.webp'),
  'hoi-an-lanterne': require('../../../assets/adventures/discoveries/hoi-an-lanterne.webp'),
  'hoi-an-non-la': require('../../../assets/adventures/discoveries/hoi-an-non-la.webp'),
  'hoi-an-pont-couvert': require('../../../assets/adventures/discoveries/hoi-an-pont-couvert.webp'),
  'mekong-lotus': require('../../../assets/adventures/discoveries/mekong-lotus.webp'),
  'mekong-mangue': require('../../../assets/adventures/discoveries/mekong-mangue.webp'),
  'mekong-noix-de-coco': require('../../../assets/adventures/discoveries/mekong-noix-de-coco.webp'),
  'mekong-panier-de-fruits': require('../../../assets/adventures/discoveries/mekong-panier-de-fruits.webp'),
  'mekong-poisson': require('../../../assets/adventures/discoveries/mekong-poisson.webp'),
  'mekong-sampan': require('../../../assets/adventures/discoveries/mekong-sampan.webp'),
  'phong-nha-boussole': require('../../../assets/adventures/discoveries/phong-nha-boussole.webp'),
  'phong-nha-cristal': require('../../../assets/adventures/discoveries/phong-nha-cristal.webp'),
  'phong-nha-fougere': require('../../../assets/adventures/discoveries/phong-nha-fougere.webp'),
  'phong-nha-lampe': require('../../../assets/adventures/discoveries/phong-nha-lampe.webp'),
  'sa-pa-fleur-de-pecher': require('../../../assets/adventures/discoveries/sa-pa-fleur-de-pecher.webp'),
  'sa-pa-foulard': require('../../../assets/adventures/discoveries/sa-pa-foulard.webp'),
  'sa-pa-theiere': require('../../../assets/adventures/discoveries/sa-pa-theiere.webp'),
};

/** Carte postale d'une destination ; `null` pour un slug inconnu (catalogue plus récent que l'app). */
export const destinationImage = (slug: string): ImageSourcePropType | null => DESTINATIONS[slug] ?? null;
/** Image d'une trouvaille ; `null` pour un slug inconnu. */
export const discoveryImage = (slug: string): ImageSourcePropType | null => DISCOVERIES[slug] ?? null;
export const DESTINATION_IMAGE_SLUGS = Object.keys(DESTINATIONS);
export const DISCOVERY_IMAGE_SLUGS = Object.keys(DISCOVERIES);
