import type { Theme } from './types';

/**
 * Thème « cosmos » (sombre) : fond bleu ardoise nocturne, panneaux plus foncés aux coins arrondis, tuiles pastel (pêche, crème, menthe, ciel),
 * étoiles, astronaute, planète à anneau et fusée, aucune ombre floue. Réf. : docs/mockups/theme-cosmos-reference.png (écran d'accueil fourni par Teo).
 * Les textes sont crème sur les fonds sombres, bleu nuit sur les aplats pastel (`onTile`, `onPrimary`, `onSolid`, `onNavActive`).
 */
const LINE = '#102338';
const CREAM = '#F5F0E1';
const NIGHT = '#14263A';
const PEACH = '#FBD59A';

export const cosmos: Theme = {
  id: 'cosmos',
  colors: {
    primary: PEACH,
    accent: PEACH,
    primaryLight: '#FDE7C2',
    mint: '#8FD9C2',
    background: '#436079',
    backgroundTop: '#53728F',
    backgroundBottom: '#3E5A75',
    card: '#3B556E',
    cardStrong: '#46627D',
    cardSolid: '#3B556E',
    glassBorder: LINE,
    glassBorderSoft: 'rgba(16,35,56,0.55)',
    text: CREAM,
    textSecondary: '#E1EBF3',
    navy: '#46698C',
    navyDeep: '#3D5E80',
    navyLight: '#4F7498',
    onNavy: '#FFFFFF',
    onNavySecondary: '#DCE8F2',
    navyBorder: LINE,
    barFrom: '#34506A',
    barTo: '#34506A',
    onBar: CREAM,
    navActive: PEACH,
    ringOnNavy: PEACH,
    trackOnNavy: 'rgba(255,255,255,0.25)',
    onPrimary: NIGHT,
    onSolid: NIGHT,
    onTile: NIGHT,
    onNavActive: NIGHT,
    ring: PEACH,
    danger: '#FFB3AE',
    success: '#9BE6BF',
    warning: '#FFD58A',
    primaryTint: 'rgba(251,213,154,0.22)',
    mintTint: 'rgba(143,217,194,0.22)',
    warningTint: '#5C4B2E',
    successTint: 'rgba(155,230,191,0.22)',
    separator: 'rgba(245,240,225,0.18)',
    tileTeal: '#9CCFC6',
    tileBlue: '#C9E8F7',
    tileIce: PEACH,
    tileViolet: '#F3A6A0',
    inputBg: '#2C4259',
    track: 'rgba(245,240,225,0.2)',
    placeholder: '#C0D0DE',
  },
  radius: { card: 28, tile: 24, control: 18, pill: 999 },
  lineWidth: 1.5,
  shadow: '0px 0px 0px rgba(0,0,0,0)',
  shadowSmall: '0px 0px 0px rgba(0,0,0,0)',
  shadowInset: '0px 0px 0px rgba(0,0,0,0)',
  chartTones: ['#FBD59A', '#9CCFC6', '#C9E8F7', '#F3A6A0', '#C9B9F0', '#F4C59B', '#8FD9C2'],
  categoryColors: { study: '#8FC4F0', sport: '#B9A6F2', chores: '#FBD59A', personal: '#8FD9C2', other: '#AFBFCF' },
  rewardTints: { gift: '#F4B07A', 'gamepad-2': '#F4B07A', film: '#B9A6F2', smartphone: '#8FC4F0', cookie: '#FBD59A', star: '#FFE08A', pizza: '#F3A6A0', popcorn: '#FBD59A', ticket: '#C9B9F0', trophy: '#FFE08A' },
  childSoft: {
    '#1E88F5': '#8FC4F0', '#2EC4A6': '#8FD9C2', '#8B5CF6': '#C9B9F0', '#F5A623': '#FBD59A', '#E5484D': '#F3A6A0',
    // couleurs choisies sous le thème « verre givré » : même correspondance
    '#3A7CA5': '#8FC4F0', '#2F8F80': '#8FD9C2', '#6E6BB8': '#C9B9F0', '#B07A28': '#FBD59A', '#A83A44': '#F3A6A0',
  },
  childPalette: ['#8FC4F0', '#8FD9C2', '#C9B9F0', '#FBD59A', '#F3A6A0'],
  decor: 'cosmos',
  browserColor: '#3E5A75',
};
