import type { HomeVideoGeometry } from '@/domain/home-video';

/**
 * Vidéos d'accueil de la V2 (D-106) : décor `home` animé avec le panda du stade AFFICHÉ (720×1280, 9:16, sans son, boucle raccordée).
 * TOUS les `require` des vidéos sont ICI (jamais dans un écran). Fichiers fournis (branches `assets/v2-video`, `assets/v2-video-dong-hanh`), jamais modifiés.
 *
 * TABLE stade → vidéo : ajouter un stade (1 « bé », 2 « nhí ») = déposer ses 4 fichiers et ajouter UNE entrée ici (sources + géométrie mesurée sur
 * l'aperçu : haut de la pousse `headY` et bas des pieds `feetY`, en fraction de la hauteur ; `maxFill` < 1 si le panda est filmé de trop près). Un stade absent garde le décor fixe + `PandaSprite`.
 * Le cadrage (`object-position`) est calculé par vidéo à partir de sa géométrie (`homeVideoLayout`) : les pieds tombent toujours sur la ligne de sol.
 */
export type HomeVideoSources = { webm: unknown; mp4: unknown; mp4Small: unknown; poster: unknown };
export type HomeVideoEntry = { key: string; sources: HomeVideoSources; geometry: HomeVideoGeometry };

export const HOME_VIDEOS: Readonly<Partial<Record<number, HomeVideoEntry>>> = {
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
  // 5,5 s ; même décor, mais panda filmé de plus près : de 43,8 % (pousse) à 73,6 % (pieds), mesuré sur l'aperçu. `maxFill` 0,74 : le panda
  // n'occupe que 74 % de la hauteur libre (≈ la taille du panda teen, un peu plus grand), la vidéo est réduite et centrée, côtés flous fondus.
  4: {
    key: 'home-dong-hanh',
    sources: {
      webm: require('../../assets/v2/video/home-dong-hanh.webm'),
      mp4: require('../../assets/v2/video/home-dong-hanh.mp4'),
      mp4Small: require('../../assets/v2/video/home-dong-hanh@480.mp4'),
      poster: require('../../assets/v2/video/home-dong-hanh-poster.webp'),
    },
    geometry: { width: 720, height: 1280, headY: 0.438, feetY: 0.736, maxFill: 0.74 },
  },
};

/** Vidéo d'accueil du stade AFFICHÉ (décalage compris) ; `null` = pas de vidéo pour ce stade (décor fixe + `PandaSprite`). */
export const homeVideoForStage = (stage: number): HomeVideoEntry | null => HOME_VIDEOS[stage] ?? null;
