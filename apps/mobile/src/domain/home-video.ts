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
 * Géométrie d'une vidéo d'accueil : taille et position verticale du panda (haut de la pousse, bas des pieds) en fraction de la hauteur, centré en largeur.
 * `maxFill` (0..1, défaut 1) : part maximale de la hauteur libre (sous les boutons, au-dessus du sol) que le panda peut occuper. Un panda filmé de plus
 * près (đồng hành) prend une valeur < 1 : la vidéo est alors affichée plus petite, centrée, et les côtés montrent le décor flouté (bords fondus).
 */
export type HomeVideoGeometry = { width: number; height: number; headY: number; feetY: number; maxFill?: number };
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
  /** largeur (px) du fondu des bords gauche et droit de la boîte quand elle est plus étroite que l'en-tête (0 = pleine largeur, pas de fondu) */
  feather: number;
  /**
   * fond des côtés (aperçu flouté) quand la boîte est plus étroite que l'en-tête, en px dans l'en-tête : la même image en cover sur TOUTE la largeur,
   * calée pour que son sol tombe sur la même ligne que celui de la vidéo (sinon les côtés montreraient du ciel à hauteur du sable)
   */
  backdrop: { left: number; top: number; width: number; height: number };
  /** image affichée (cover) dans la boîte, en px : sert à poser l'aperçu fixe exactement là où la vidéo peindra sa première image */
  image: { left: number; top: number; width: number; height: number };
};

/** Fondu maximal (px) des bords d'une boîte vidéo plus étroite que l'en-tête : pas de jointure nette avec le décor flouté des côtés. */
export const HOME_VIDEO_FEATHER = 24;
/** `mask-image` CSS du fondu des bords (web) ; `undefined` sans fondu. */
export const featherMask = (feather: number): string | undefined =>
  feather > 0 ? `linear-gradient(to right, transparent 0, #000 ${feather}px, #000 calc(100% - ${feather}px), transparent 100%)` : undefined;

/**
 * Cadrage sans déformation (`cover`) : les pieds du panda tombent sur `groundY` (même ligne de sol que le `PandaSprite`), et le panda reste entier sous
 * les boutons du haut (`topClear`). Sur un écran large, la vidéo pleine largeur grandirait le panda au-delà de l'en-tête : la boîte vidéo est alors
 * réduite (centrée) à la largeur qui le garde entier, le reste de l'en-tête montrant l'image fixe floutée. Même chose quand `maxFill` limite la taille
 * du panda (vidéo filmée de plus près) : sur téléphone aussi, la boîte est alors plus étroite que l'en-tête.
 */
export function homeVideoLayout(o: { width: number; height: number; groundY: number; topClear: number }, g: HomeVideoGeometry = HOME_VIDEO): HomeVideoLayout {
  const ratio = g.height / g.width;
  const span = g.feetY - g.headY;
  const room = Math.max(1, (o.groundY - o.topClear) * Math.min(1, Math.max(0.1, g.maxFill ?? 1)));
  const maxBox = Math.floor(room / (span * ratio));
  const boxWidth = Math.max(1, Math.min(Math.floor(o.width), maxBox));
  // cover : l'échelle remplit la boîte en largeur ET en hauteur
  const scale = Math.max(boxWidth / g.width, o.height / g.height);
  const shown = g.height * scale;
  const extra = Math.max(0, shown - o.height);
  const offset = Math.max(0, Math.min(extra, g.feetY * shown - o.groundY));
  const boxLeft = Math.round((o.width - boxWidth) / 2);
  const bgScale = Math.max(o.width / g.width, o.height / g.height);
  const bgShown = g.height * bgScale;
  const bgOffset = Math.max(0, Math.min(bgShown - o.height, g.feetY * bgShown - o.groundY));
  return {
    boxWidth,
    boxLeft,
    feather: boxLeft > 0 ? Math.min(HOME_VIDEO_FEATHER, boxLeft) : 0,
    objectPositionY: extra > 0 ? Math.round((offset / extra) * 1000) / 10 : 50,
    pandaTop: Math.round(g.headY * shown - offset),
    pandaBottom: Math.round(g.feetY * shown - offset),
    backdrop: { left: Math.round((o.width - g.width * bgScale) / 2), top: -Math.round(bgOffset), width: Math.round(g.width * bgScale), height: Math.round(bgShown) },
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
