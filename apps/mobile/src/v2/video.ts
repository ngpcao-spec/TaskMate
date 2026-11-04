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
/**
 * `groundColor` : couleur du sable au BAS visible de la vidéo (médiane de la dernière bande affichée à 375–430 px, mesurée sur l'aperçu). Quand la
 * vidéo est affichée, le fond de l'écran sous l'en-tête prend cette couleur (prolongement de la vidéo, fondu au bas de l'en-tête).
 */
export type HomeVideoEntry = { key: string; sources: HomeVideoSources; geometry: HomeVideoGeometry; groundColor: string };

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
    groundColor: '#F7D495',
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
    groundColor: '#F7D095',
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
    groundColor: '#FAD195',
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
    groundColor: '#F8CA8A',
  },
};

/** Vidéo d'accueil du stade AFFICHÉ (décalage compris) ; `null` = pas de vidéo pour ce stade (décor fixe + `PandaSprite`). */
export const homeVideoForStage = (stage: number): HomeVideoEntry | null => HOME_VIDEOS[stage] ?? null;

/**
 * Réactions du panda vidéo (D-106) : vidéos NON bouclées, même décor, même cadrage et même position du panda que la vidéo de repos du stade
 * (donc même géométrie, même `object-position`). TABLE stade → réactions disponibles : un stade absent (2, 3, 4 aujourd'hui) n'a aucune réaction
 * vidéo (`happy` garde le fondu vers le décor fixe et le `PandaSprite` « très heureux » ; toucher et coucher sans effet visible). Ajouter un stade
 * = déposer ses fichiers et écrire UNE entrée ici. `sleepEnd` : image du panda endormi.
 */
export type HomeReactionClip = { key: string; sources: HomeVideoSources };
/**
 * `sleep` : transition jouée une fois à la fin de la journée ; `sleepLoop` : panda endormi en boucle ensuite (sans elle : image `sleepEnd`) ;
 * `sleepEnd` : image du panda endormi (images fixes, lecture refusée, aperçu sous la boucle).
 */
export type HomeReactions = { happy?: HomeReactionClip; curious?: HomeReactionClip; sleep?: HomeReactionClip; sleepLoop?: HomeReactionClip; sleepEnd?: unknown };

export const HOME_REACTIONS: Readonly<Partial<Record<number, HomeReactions>>> = {
  1: {
    // il applaudit, 6 s
    happy: {
      key: 'be-happy',
      sources: {
        webm: require('../../assets/v2/video/reactions/be-happy.webm'),
        mp4: require('../../assets/v2/video/reactions/be-happy.mp4'),
        mp4Small: require('../../assets/v2/video/reactions/be-happy@480.mp4'),
        poster: require('../../assets/v2/video/reactions/be-happy-poster.webp'),
      },
    },
    // il regarde autour de lui, penche la tête, sourit, 8 s
    curious: {
      key: 'be-curious',
      sources: {
        webm: require('../../assets/v2/video/reactions/be-curious.webm'),
        mp4: require('../../assets/v2/video/reactions/be-curious.mp4'),
        mp4Small: require('../../assets/v2/video/reactions/be-curious@480.mp4'),
        poster: require('../../assets/v2/video/reactions/be-curious-poster.webp'),
      },
    },
    // fin de journée : TRANSITION jouée une fois (assis → il se couche → il s'endort, 8 s)…
    sleep: {
      key: 'be-fall-asleep',
      sources: {
        webm: require('../../assets/v2/video/reactions/be-fall-asleep.webm'),
        mp4: require('../../assets/v2/video/reactions/be-fall-asleep.mp4'),
        mp4Small: require('../../assets/v2/video/reactions/be-fall-asleep@480.mp4'),
        poster: require('../../assets/v2/video/reactions/be-fall-asleep-poster.webp'),
      },
    },
    // … puis il RESTE endormi : vidéo du sommeil (« zzz », 8 s) en boucle, jusqu'au réveil (tâche décochée, nouveau jour)
    sleepLoop: {
      key: 'be-sleep',
      sources: {
        webm: require('../../assets/v2/video/reactions/be-sleep.webm'),
        mp4: require('../../assets/v2/video/reactions/be-sleep.mp4'),
        mp4Small: require('../../assets/v2/video/reactions/be-sleep@480.mp4'),
        poster: require('../../assets/v2/video/reactions/be-sleep-poster.webp'),
      },
    },
    sleepEnd: require('../../assets/v2/video/reactions/be-sleep-end.webp'),
  },
};

/** Réactions vidéo du stade AFFICHÉ ; `null` = aucune (comportement d'avant). */
export const homeReactionsForStage = (stage: number): HomeReactions | null => HOME_REACTIONS[stage] ?? null;

/** Réactions qui ont une vidéo pour ce stade (le coucher exige aussi son image de fin). */
export function availableReactions(r: HomeReactions | null): Set<'happy' | 'curious' | 'sleep'> {
  const out = new Set<'happy' | 'curious' | 'sleep'>();
  if (!r) return out;
  if (r.happy) out.add('happy');
  if (r.curious) out.add('curious');
  if (r.sleep && r.sleepEnd) out.add('sleep');
  return out;
}
