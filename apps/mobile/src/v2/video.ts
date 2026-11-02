/**
 * Vidéo d'accueil de la V2 (D-106) : décor `home` animé avec le panda teen (720×1280, 9:16, 9,5 s, sans son, boucle raccordée).
 * TOUS les `require` de la vidéo sont ICI (jamais dans un écran). Fichiers fournis (branche `assets/v2-video`), jamais modifiés.
 */
export const HOME_VIDEO_SOURCES = {
  webm: require('../../assets/v2/video/home-teen.webm'),
  mp4: require('../../assets/v2/video/home-teen.mp4'),
  mp4Small: require('../../assets/v2/video/home-teen@480.mp4'),
  poster: require('../../assets/v2/video/home-teen-poster.webp'),
} as const;
