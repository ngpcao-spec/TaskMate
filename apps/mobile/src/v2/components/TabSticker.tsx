import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

/**
 * Icônes d'onglets « autocollant » de la V2 (D-106) : dessins ORIGINAUX (formes simples, aucune image de tiers), couleurs vives, contour blanc épais.
 * Chaque dessin est une liste de formes : le calque de contour les redessine en blanc, élargies (`OUTLINE`), puis le calque de couleur par-dessus ;
 * les détails intérieurs (`detail`) n'entrent pas dans le contour. Palette propre aux illustrations (comme une image), pas des jetons d'interface.
 */
export type TabStickerName = 'home' | 'rewards' | 'adventure' | 'stats' | 'me' | 'calendar' | 'review' | 'settings';
export const TAB_STICKERS: readonly TabStickerName[] = ['home', 'rewards', 'adventure', 'stats', 'me', 'calendar', 'review', 'settings'];

type Shape =
  | { t: 'path'; d: string; fill: string; detail?: boolean; stroke?: string; sw?: number }
  | { t: 'rect'; x: number; y: number; w: number; h: number; r?: number; fill: string; detail?: boolean }
  | { t: 'circle'; cx: number; cy: number; r: number; fill: string; detail?: boolean }
  | { t: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill: string; detail?: boolean; rot?: number };

const P = {
  white: '#FFFFFF',
  outline: '#FFFFFF',
  /** liseré beige autour du contour blanc : l'autocollant reste lisible sur la barre crème */
  edge: '#E3CDA4',
  orange: '#F28C38',
  orangeDark: '#D9702A',
  yellow: '#FFC75F',
  yellowDark: '#F2A93B',
  brown: '#9A5B2E',
  red: '#EF5B5B',
  redDark: '#D94848',
  pink: '#FF8A8A',
  green: '#5BBF89',
  greenLight: '#8FDDB0',
  greenDark: '#3E9B68',
  blue: '#5DA9F6',
  blueDark: '#3C88D6',
  cream: '#FFF3D6',
  ink: '#3B2A1E',
  grey: '#93A7BC',
  greyDark: '#71879E',
} as const;

/** engrenage : dents régulières autour d'un cercle */
function gearPath(cx: number, cy: number, rOut: number, rIn: number, teeth: number): string {
  const pts: string[] = [];
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2;
    const r = i % 4 === 0 || i % 4 === 1 ? rOut : rIn;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join(' L')} Z`;
}

const SHAPES: Record<TabStickerName, Shape[]> = {
  home: [
    { t: 'rect', x: 11, y: 22, w: 26, h: 19, r: 3, fill: P.yellow },
    { t: 'path', d: 'M6 24 L24 8 L42 24 Q42 27 39 27 L9 27 Q6 27 6 24 Z', fill: P.orange },
    { t: 'rect', x: 20, y: 30, w: 8, h: 11, r: 3, fill: P.brown, detail: true },
    { t: 'circle', cx: 24, cy: 19, r: 3.2, fill: P.yellowDark, detail: true },
  ],
  rewards: [
    { t: 'rect', x: 9, y: 21, w: 30, h: 20, r: 3, fill: P.red },
    { t: 'rect', x: 7, y: 15, w: 34, h: 8, r: 3, fill: P.pink },
    { t: 'ellipse', cx: 19, cy: 12, rx: 6, ry: 4, rot: -25, fill: P.yellow },
    { t: 'ellipse', cx: 29, cy: 12, rx: 6, ry: 4, rot: 25, fill: P.yellow },
    { t: 'rect', x: 21, y: 15, w: 6, h: 26, fill: P.yellow, detail: true },
    { t: 'rect', x: 9, y: 23, w: 30, h: 2, fill: P.redDark, detail: true },
  ],
  adventure: [
    { t: 'path', d: 'M6 12 L17 8 L17 38 L6 42 Z', fill: P.green },
    { t: 'path', d: 'M17 8 L31 12 L31 42 L17 38 Z', fill: P.greenLight },
    { t: 'path', d: 'M31 12 L42 8 L42 38 L31 42 Z', fill: P.green },
    { t: 'path', d: 'M11 33 Q17 24 24 28 T36 18', fill: 'none', stroke: P.redDark, sw: 2.2, detail: true },
    { t: 'path', d: 'M36 9 C40 9 41 13 39 16 L36 20 L33 16 C31 13 32 9 36 9 Z', fill: P.red },
    { t: 'circle', cx: 36, cy: 13, r: 1.6, fill: P.white, detail: true },
  ],
  stats: [
    { t: 'rect', x: 6, y: 34, w: 36, h: 7, r: 3, fill: P.cream },
    { t: 'rect', x: 9, y: 24, w: 8, h: 12, r: 2.5, fill: P.blue },
    { t: 'rect', x: 20, y: 15, w: 8, h: 21, r: 2.5, fill: P.green },
    { t: 'rect', x: 31, y: 8, w: 8, h: 28, r: 2.5, fill: P.orange },
  ],
  me: [
    { t: 'circle', cx: 13, cy: 15, r: 6, fill: P.ink },
    { t: 'circle', cx: 35, cy: 15, r: 6, fill: P.ink },
    { t: 'ellipse', cx: 24, cy: 27, rx: 16, ry: 14, fill: P.white },
    { t: 'ellipse', cx: 17.5, cy: 26, rx: 4, ry: 5, rot: 25, fill: P.ink, detail: true },
    { t: 'ellipse', cx: 30.5, cy: 26, rx: 4, ry: 5, rot: -25, fill: P.ink, detail: true },
    { t: 'circle', cx: 18, cy: 25.5, r: 1.4, fill: P.white, detail: true },
    { t: 'circle', cx: 30, cy: 25.5, r: 1.4, fill: P.white, detail: true },
    { t: 'ellipse', cx: 24, cy: 32, rx: 2.4, ry: 1.7, fill: P.ink, detail: true },
    { t: 'path', d: 'M24 13 C22 8 18 7 15 8 C17 11 20 13 24 13 Z', fill: P.green },
    { t: 'path', d: 'M24 13 C26 9 30 8 33 9 C31 12 28 13 24 13 Z', fill: P.greenDark },
  ],
  calendar: [
    { t: 'rect', x: 8, y: 11, w: 32, h: 30, r: 5, fill: P.cream },
    { t: 'path', d: 'M8 16 Q8 11 13 11 L35 11 Q40 11 40 16 L40 20 L8 20 Z', fill: P.red },
    { t: 'rect', x: 15, y: 7, w: 4, h: 8, r: 2, fill: P.greyDark },
    { t: 'rect', x: 29, y: 7, w: 4, h: 8, r: 2, fill: P.greyDark },
    { t: 'path', d: 'M17 30 L22 35 L31 25', fill: 'none', stroke: P.greenDark, sw: 3.2, detail: true },
  ],
  review: [
    { t: 'path', d: 'M6 13 Q15 9 24 14 L24 40 Q15 35 6 39 Z', fill: P.cream },
    { t: 'path', d: 'M42 13 Q33 9 24 14 L24 40 Q33 35 42 39 Z', fill: P.cream },
    { t: 'path', d: 'M24 14 L24 40', fill: 'none', stroke: P.blueDark, sw: 2.4, detail: true },
    { t: 'path', d: 'M10 19 Q15 17 20 19 M10 24 Q15 22 20 24 M28 19 Q33 17 38 19 M28 24 Q33 22 38 24', fill: 'none', stroke: P.blue, sw: 1.8, detail: true },
    { t: 'path', d: 'M30 28 L33 34 L36 28 Z', fill: P.red, detail: true },
  ],
  settings: [
    { t: 'path', d: gearPath(24, 24, 17, 13, 8), fill: P.grey },
    { t: 'circle', cx: 24, cy: 24, r: 6, fill: P.cream, detail: true },
    { t: 'circle', cx: 24, cy: 24, r: 2.6, fill: P.greyDark, detail: true },
  ],
};

/** contour blanc et liseré (largeur du trait, en unités du dessin 48×48) */
const OUTLINE = 6;
const EDGE = 8.5;

type Layer = 'edge' | 'outline' | 'color';

function draw(s: Shape, layer: Layer, i: number) {
  const flat = layer === 'edge' ? P.edge : P.outline;
  const fill = layer === 'color' ? s.fill : flat;
  const stroke = layer === 'color' ? (s.t === 'path' ? s.stroke : undefined) : flat;
  const sw = layer === 'color' ? (s.t === 'path' ? s.sw : undefined) : layer === 'edge' ? EDGE : OUTLINE;
  const common = { fill, stroke, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  switch (s.t) {
    case 'path':
      return <Path key={i} {...common} d={s.d} />;
    case 'rect':
      return <Rect key={i} {...common} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r ?? 0} />;
    case 'circle':
      return <Circle key={i} {...common} cx={s.cx} cy={s.cy} r={s.r} />;
    case 'ellipse':
      return <Ellipse key={i} {...common} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} transform={s.rot ? `rotate(${s.rot} ${s.cx} ${s.cy})` : undefined} />;
  }
}

/** Icône d'onglet « autocollant » ; décorative (le libellé de l'onglet porte l'accessibilité). */
export function TabSticker({ name, size = 34 }: { name: TabStickerName; size?: number }) {
  const shapes = SHAPES[name];
  return (
    <Svg width={size} height={size} viewBox="-3 -3 54 54" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={`v2-tab-sticker-${name}`}>
      <G>{shapes.filter((s) => !s.detail).map((s, i) => draw(s, 'edge', i))}</G>
      <G>{shapes.filter((s) => !s.detail).map((s, i) => draw(s, 'outline', i))}</G>
      <G>{shapes.map((s, i) => draw(s, 'color', i))}</G>
    </Svg>
  );
}
