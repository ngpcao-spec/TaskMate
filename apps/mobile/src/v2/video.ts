import type { HomeVideoGeometry } from '@/domain/home-video';

/**
 * Vidéos d'accueil de la V2 (D-106) : décor `home` animé avec le panda du stade AFFICHÉ (720×1280, 9:16, sans son, boucle raccordée).
 * TOUS les `require` des vidéos sont ICI (jamais dans un écran). Fichiers fournis par Teo (branches `assets/v2-video`, `assets/v2-video-dong-hanh`, `assets/v2-video-nhi`, `assets/v2-video-be`, puis vidéo đồng hành « plan large » réencodée sans le son), jamais retouchés.
 *
 * TABLE stade → vidéo : les 4 stades (1 bé, 2 nhí, 3 teen, 4 đồng hành) ont leur vidéo ; remplacer ou ajouter une vidéo = déposer ses 4 fichiers et
 * écrire UNE entrée ici (sources + géométrie mesurée sur
 * l'aperçu : haut de la pousse `headY` et bas des pieds `feetY`, en fraction de la hauteur). Un stade absent garde le décor fixe + `PandaSprite`.
 * Le cadrage (`object-position`) est calculé par vidéo à partir de sa géométrie (`homeVideoLayout`) : les pieds tombent toujours sur la ligne de sol.
 */
export type HomeVideoSources = { webm: unknown; mp4: unknown; mp4Small: unknown; poster: unknown };
export type HomeVideoEntry = { key: string; sources: HomeVideoSources; geometry: HomeVideoGeometry };

export const HOME_VIDEOS: Readonly<Partial<Record<number, HomeVideoEntry>>> = {
  // 5,5 s ; panda ASSIS : de 50,0 % (pousse) à 72,5 % (coussinets), mesuré sur toutes les images (tête plus basse, même hauteur que le teen
  // pousse comprise) ; centré
  // en largeur (centre à 49,4 %) ; ses pieds tombent sur la même ligne de sol que les autres stades (object-position propre, calculé)
  1: {
    key: 'home-be',
    sources: {
      webm: require('../../assets/v2/video/home-be.webm'),
      mp4: require('../../assets/v2/video/home-be.mp4'),
      mp4Small: require('../../assets/v2/video/home-be@480.mp4'),
      poster: require('../../assets/v2/video/home-be-poster.webp'),
    },
    geometry: { width: 720, height: 1280, headY: 0.5, feetY: 0.725 },
  },
  // 5,5 s ; le panda salue de la patte : de 48,5 % (pousse) à 73,0 % (pieds), mesuré sur toutes les images (la patte ne dépasse jamais la tête)
  2: {
    key: 'home-nhi',
    sources: {
      webm: require('../../assets/v2/video/home-nhi.webm'),
      mp4: require('../../assets/v2/video/home-nhi.mp4'),
      mp4Small: require('../../assets/v2/video/home-nhi@480.mp4'),
      poster: require('../../assets/v2/video/home-nhi-poster.webp'),
    },
    geometry: { width: 720, height: 1280, headY: 0.485, feetY: 0.73 },
  },
  // 9,5 s ; panda de 48,5 % (pousse) à 70,7 % (pieds)
  3: {
    key: 'home-teen',
    sources: {
      webm: require('../../assets/v2/video/home-teen.webm'),
      mp4: require('../../assets/v2/video/home-teen.mp4'),
      mp4Small: require('../../assets/v2/video/home-teen@480.mp4'),
      poster: require('../../assets/v2/video/home-teen-poster.webp'),
    },
    geometry: { width: 720, height: 1280, headY: 0.485, feetY: 0.707 },
  },
  // 6 s ; plan large fourni par Teo le 2026-11-03 (remplace la première version, panda filmé de trop près) : de 48,5 % (pousse) à 68,8 % (pieds),
  // mesuré sur l'aperçu ; panda un peu plus petit que le teen
  4: {
    key: 'home-dong-hanh',
    sources: {
      webm: require('../../assets/v2/video/home-dong-hanh.webm'),
      mp4: require('../../assets/v2/video/home-dong-hanh.mp4'),
      mp4Small: require('../../assets/v2/video/home-dong-hanh@480.mp4'),
      poster: require('../../assets/v2/video/home-dong-hanh-poster.webp'),
    },
    geometry: { width: 720, height: 1280, headY: 0.485, feetY: 0.688 },
  },
};

/** Vidéo d'accueil du stade AFFICHÉ (décalage compris) ; `null` = pas de vidéo pour ce stade (décor fixe + `PandaSprite`). */
export const homeVideoForStage = (stage: number): HomeVideoEntry | null => HOME_VIDEOS[stage] ?? null;
