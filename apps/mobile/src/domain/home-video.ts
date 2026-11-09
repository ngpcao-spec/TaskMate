/**
 * Vidéo d'accueil de la V2 (D-106) : décor « maison » animé avec le panda du stade affiché (table stade → vidéo : `src/v2/video.ts`).
 * Calculs purs : quand l'afficher, quelle source, où la cadrer.
 * La vidéo ne remplace le décor fixe et le `PandaSprite` que si TOUT est vrai (sinon rien ne change).
 */
export type HomeVideoConditions = {
  /** décor affiché par Hôm nay : `home` quand il n'y a ni aventure en cours ni trouvaille à ouvrir */
  scene: string;
  /** état de l'aventure : en voyage (`away`) ou trouvaille à ouvrir (`back`) = pas de vidéo */
  adventure: 'filling' | 'ready_to_go' | 'away' | 'back' | null | undefined;
  /** une vidéo existe pour le stade AFFICHÉ du panda (décalage choisi par l'enfant compris) : `homeVideoForStage(stage) !== null` */
  hasStageVideo: boolean;
  /** variante du panda ; absente (état enregistré avant D-106 dans le cache de l'appareil) = garçon */
  variant: string | null | undefined;
  reduceMotion: boolean;
  /** `navigator.connection.saveData` (économie de données) */
  saveData: boolean;
  /** web seulement : le natif n'a pas de vidéo d'accueil (décor fixe) */
  web: boolean;
};

export function showHomeVideo(c: HomeVideoConditions): boolean {
  return c.web && c.scene === 'home' && c.adventure !== 'away' && c.adventure !== 'back' && c.hasStageVideo && (c.variant ?? 'boy') === 'boy' && !c.reduceMotion && !c.saveData;
}

/**
 * Panda vidéo (D-106) : `video` (vidéo d'accueil et réactions), `still` (images fixes : poster du repos, image endormie le soir) ou `off`.
 * Images fixes seulement pour un stade qui a des réactions vidéo (les 4 stades aujourd'hui, le stade 4 sans « curieux »), quand tout le reste est réuni mais que l'utilisateur
 * demande moins d'animations, économise ses données ou est hors ligne. Les autres stades gardent le comportement d'avant (décor fixe + PandaSprite).
 */
export function homeMediaMode(c: HomeVideoConditions & { hasReactions: boolean; offline: boolean }): 'video' | 'still' | 'off' {
  if (!c.offline && showHomeVideo(c)) return 'video';
  if (!c.hasReactions) return 'off';
  const base = c.web && c.scene === 'home' && c.adventure !== 'away' && c.adventure !== 'back' && c.hasStageVideo && (c.variant ?? 'boy') === 'boy';
  return base && (c.reduceMotion || c.saveData || c.offline) ? 'still' : 'off';
}

/** Géométrie d'une vidéo d'accueil : taille et position verticale du panda (haut de la pousse, bas des pieds) en fraction de la hauteur, centré en largeur. */
export type HomeVideoGeometry = { width: number; height: number; headY: number; feetY: number };
/** Géométrie de la vidéo teen (720×1280) : le panda va de 48,5 % à 70,7 % de la hauteur. Valeur par défaut du cadrage. */
export const HOME_VIDEO: HomeVideoGeometry = { width: 720, height: 1280, headY: 0.485, feetY: 0.707 };

/** En dessous de cette largeur d'en-tête (px), la variante 480 px suffit. */
export const SMALL_VIDEO_BELOW = 400;
export const homeVideoSize = (headerWidth: number): 'small' | 'full' => (headerWidth < SMALL_VIDEO_BELOW ? 'small' : 'full');

export type HomeVideoLayout = {
  /** largeur de la boîte vidéo, centrée dans l'en-tête (= largeur de l'en-tête sur téléphone) */
  boxWidth: number;
  boxLeft: number;
  /** `object-position` vertical (%) de la vidéo en `object-fit: cover` */
  objectPositionY: number;
  /** haut (oreilles) et bas (pieds) du panda dans l'en-tête (px) */
  pandaTop: number;
  pandaBottom: number;
  /** image affichée (cover) dans la boîte, en px : sert à poser l'aperçu fixe exactement là où la vidéo peindra sa première image */
  image: { left: number; top: number; width: number; height: number };
};

/**
 * Cadrage sans déformation (`cover`) : les pieds du panda tombent sur `groundY` (même ligne de sol que le `PandaSprite`), et le panda reste entier sous
 * les boutons du haut (`topClear`). Sur un écran large, la vidéo pleine largeur grandirait le panda au-delà de l'en-tête : la boîte vidéo est alors
 * réduite (centrée) à la largeur qui le garde entier, le reste de l'en-tête montrant l'image fixe floutée.
 */
export function homeVideoLayout(o: { width: number; height: number; groundY: number; topClear: number }, g: HomeVideoGeometry = HOME_VIDEO): HomeVideoLayout {
  const ratio = g.height / g.width;
  const span = g.feetY - g.headY;
  const room = Math.max(1, o.groundY - o.topClear);
  const maxBox = Math.floor(room / (span * ratio));
  const boxWidth = Math.max(1, Math.min(Math.floor(o.width), maxBox));
  // cover : l'échelle remplit la boîte en largeur ET en hauteur
  const scale = Math.max(boxWidth / g.width, o.height / g.height);
  const shown = g.height * scale;
  const extra = Math.max(0, shown - o.height);
  const offset = Math.max(0, Math.min(extra, g.feetY * shown - o.groundY));
  return {
    boxWidth,
    boxLeft: Math.round((o.width - boxWidth) / 2),
    objectPositionY: extra > 0 ? Math.round((offset / extra) * 1000) / 10 : 50,
    pandaTop: Math.round(g.headY * shown - offset),
    pandaBottom: Math.round(g.feetY * shown - offset),
    image: { left: Math.round((boxWidth - g.width * scale) / 2), top: -Math.round(offset), width: Math.round(g.width * scale), height: Math.round(shown) },
  };
}

/**
 * Ordre des sources : Safari (iPhone, iPad, Mac — et tout navigateur iOS, qui est un Safari) décode le H.264 (mp4) par la puce, mais accepte le webm (VP9)
 * en le décodant lentement : mp4 d'abord. Ailleurs, webm d'abord (plus léger), mp4 en secours. Le mp4 480 px remplace le mp4 sous 400 px de large.
 */
export type HomeVideoSourceKey = 'webm' | 'mp4' | 'mp4Small';
export function isAppleWebKit(userAgent: string): boolean {
  const ios = /iPhone|iPad|iPod/.test(userAgent);
  const macSafari = /Macintosh/.test(userAgent) && /Safari\//.test(userAgent) && !/Chrome|Chromium|Edg\/|Firefox|OPR\//.test(userAgent);
  return ios || macSafari;
}
export function homeVideoSources(userAgent: string, headerWidth: number): { key: HomeVideoSourceKey; type: 'video/webm' | 'video/mp4' }[] {
  const mp4 = { key: homeVideoSize(headerWidth) === 'small' ? ('mp4Small' as const) : ('mp4' as const), type: 'video/mp4' as const };
  const webm = { key: 'webm' as const, type: 'video/webm' as const };
  return isAppleWebKit(userAgent) ? [mp4, webm] : [webm, mp4];
}

/** La vidéo n'apparaît (au-dessus de l'aperçu fixe) que quand la vidéo JOUE vraiment (une image peinte) : sur iPhone, « canplay » arrive avant la première image. */
export const videoShowsFrames = (v: { paused: boolean; currentTime: number }): boolean => !v.paused && v.currentTime > 0;

/** Cible tactile minimale (pt). */
export const MIN_HIT = 44;

/**
 * Zone tactile du panda (toucher → `curious`, D-106), en px dans l'en-tête : le rectangle du panda dans la vidéo (haut de la pousse → pieds, centré),
 * un peu élargi, au moins 44 × 44 ; jamais au-dessus de `topClear` (boutons du haut) ni sous `bottomLimit` (carte Phiêu lưu posée sur l'en-tête).
 */
export function pandaHitRect(
  l: Pick<HomeVideoLayout, 'boxLeft' | 'boxWidth' | 'pandaTop' | 'pandaBottom'>,
  o: { topClear: number; bottomLimit: number; width: number },
): { left: number; top: number; width: number; height: number } {
  const span = Math.max(0, l.pandaBottom - l.pandaTop);
  const margin = 6;
  const top = Math.max(o.topClear, l.pandaTop - margin);
  const bottom = Math.min(o.bottomLimit, l.pandaBottom + margin);
  const height = Math.max(MIN_HIT, bottom - top);
  // le panda fait à peu près sa hauteur en largeur (assis comme debout, pousse comprise) : un peu plus large que lui
  const width = Math.min(o.width, Math.max(MIN_HIT, Math.round(span * 1.1)));
  const centerX = l.boxLeft + l.boxWidth / 2;
  const left = Math.max(0, Math.min(o.width - width, Math.round(centerX - width / 2)));
  return { left, top: Math.min(top, o.bottomLimit - height), width, height };
}

// ───────────── Vidéo de voyage (D-107) ─────────────

/**
 * Pendant le voyage (`away`), la vidéo de voyage du stade (panda qui marche avec son sac, décor qui défile) remplace la maison vide et le mot épinglé.
 * `video` : en boucle ; `still` : son aperçu fixe (« réduire les animations ») ; `off` : maison vide + mot (comportement D-107), c.-à-d. pas de vidéo
 * pour ce stade, natif, économie de données, hors ligne, ou lecture refusée / fichier illisible (`failed`).
 */
export type TripVideoConditions = {
  /** le panda est en voyage ET la séquence de départ est finie */
  away: boolean;
  hasTripVideo: boolean;
  variant: string | null | undefined;
  reduceMotion: boolean;
  saveData: boolean;
  offline: boolean;
  web: boolean;
  /** la lecture a été refusée ou aucune source n'est lisible : maison vide + mot jusqu'à la sortie de l'écran */
  failed: boolean;
};
export function tripMediaMode(c: TripVideoConditions): 'video' | 'still' | 'off' {
  if (!c.web || !c.away || !c.hasTripVideo || (c.variant ?? 'boy') !== 'boy' || c.failed || c.saveData || c.offline) return 'off';
  return c.reduceMotion ? 'still' : 'video';
}

/**
 * Cadrage de la vidéo de voyage (PAYSAGE) : `cover` sans zoom ni déformation. Sur téléphone, toute la hauteur est gardée et les côtés sont coupés
 * (centrée) ; les pieds y tomberaient au-dessus de la ligne de sol, la vidéo est donc DESCENDUE (`drop`) pour que les pieds tombent sur `groundY`,
 * comme ceux des vidéos de la maison : son bas passe sous la carte Phiêu lưu, la bande libérée en haut (sous la barre d'état et les boutons) montre
 * l'aperçu flouté. Écran large : même cadrage que `homeVideoLayout` (`object-position` vertical, boîte réduite si le panda ne tiendrait pas).
 */
export function tripVideoLayout(o: { width: number; height: number; groundY: number; topClear: number }, g: HomeVideoGeometry): HomeVideoLayout & { drop: number } {
  const l = homeVideoLayout(o, g);
  const drop = Math.max(0, Math.round(o.groundY - l.pandaBottom));
  return { ...l, drop, pandaTop: l.pandaTop + drop, pandaBottom: l.pandaBottom + drop, image: { ...l.image, top: l.image.top + drop } };
}
