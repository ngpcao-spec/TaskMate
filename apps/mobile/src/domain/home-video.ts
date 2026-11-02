/**
 * Vidéo d'accueil de la V2 (D-106) : décor « maison » animé avec le panda TEEN. Calculs purs : quand l'afficher, quelle source, où la cadrer.
 * La vidéo ne remplace le décor fixe et le `PandaSprite` que si TOUT est vrai (sinon rien ne change).
 */
export type HomeVideoConditions = {
  /** décor affiché par Hôm nay : `home` quand il n'y a ni aventure en cours ni trouvaille à ouvrir */
  scene: string;
  /** état de l'aventure : en voyage (`away`) ou trouvaille à ouvrir (`back`) = pas de vidéo */
  adventure: 'filling' | 'ready_to_go' | 'away' | 'back' | null | undefined;
  /** stade AFFICHÉ du panda (décalage choisi par l'enfant compris) */
  stage: number;
  /** variante du panda ; absente (état enregistré avant D-106 dans le cache de l'appareil) = garçon */
  variant: string | null | undefined;
  reduceMotion: boolean;
  /** `navigator.connection.saveData` (économie de données) */
  saveData: boolean;
  /** web seulement : le natif n'a pas de vidéo d'accueil (décor fixe) */
  web: boolean;
};

export function showHomeVideo(c: HomeVideoConditions): boolean {
  return c.web && c.scene === 'home' && c.adventure !== 'away' && c.adventure !== 'back' && c.stage === 3 && (c.variant ?? 'boy') === 'boy' && !c.reduceMotion && !c.saveData;
}

/** Géométrie de la vidéo fournie (720×1280) : le panda va de 48,5 % (oreilles) à 70,7 % (pieds) de la hauteur, centré en largeur. */
export const HOME_VIDEO = { width: 720, height: 1280, headY: 0.485, feetY: 0.707 } as const;

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
};

/**
 * Cadrage sans déformation (`cover`) : les pieds du panda tombent sur `groundY` (même ligne de sol que le `PandaSprite`), et le panda reste entier sous
 * les boutons du haut (`topClear`). Sur un écran large, la vidéo pleine largeur grandirait le panda au-delà de l'en-tête : la boîte vidéo est alors
 * réduite (centrée) à la largeur qui le garde entier, le reste de l'en-tête montrant l'image fixe floutée.
 */
export function homeVideoLayout(o: { width: number; height: number; groundY: number; topClear: number }): HomeVideoLayout {
  const ratio = HOME_VIDEO.height / HOME_VIDEO.width;
  const span = HOME_VIDEO.feetY - HOME_VIDEO.headY;
  const room = Math.max(1, o.groundY - o.topClear);
  const maxBox = Math.floor(room / (span * ratio));
  const boxWidth = Math.max(1, Math.min(Math.floor(o.width), maxBox));
  // cover : l'échelle remplit la boîte en largeur ET en hauteur
  const scale = Math.max(boxWidth / HOME_VIDEO.width, o.height / HOME_VIDEO.height);
  const shown = HOME_VIDEO.height * scale;
  const extra = Math.max(0, shown - o.height);
  const offset = Math.max(0, Math.min(extra, HOME_VIDEO.feetY * shown - o.groundY));
  return {
    boxWidth,
    boxLeft: Math.round((o.width - boxWidth) / 2),
    objectPositionY: extra > 0 ? Math.round((offset / extra) * 1000) / 10 : 50,
    pandaTop: Math.round(HOME_VIDEO.headY * shown - offset),
    pandaBottom: Math.round(HOME_VIDEO.feetY * shown - offset),
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

/** Le poster ne s'efface que quand la vidéo JOUE vraiment (une image peinte) : sur iPhone, « canplay » arrive avant la première image. */
export const videoShowsFrames = (v: { paused: boolean; currentTime: number }): boolean => !v.paused && v.currentTime > 0;
