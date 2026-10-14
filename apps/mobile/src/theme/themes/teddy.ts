import type { Theme } from './types';

/**
 * Thème « teddy » : fond rose poudré à motif vichy, cartes crème aux contours chocolat, panneaux et barre de navigation brun chocolat, aplats pastel (rose,
 * bleu poudré, beurre, sauge), oursons, pattes, fleurs et petit canard. Réf. : docs/mockups/theme-teddy-reference.png (écran d'accueil illustré fourni par Teo).
 * Contrairement à « cosmos », le texte courant est BRUN FONCÉ sur fond clair ; il est crème seulement sur les panneaux et la barre bruns (`onNavy`, `onBar`).
 */
const BROWN = '#5A372F';
const DARK = '#3F2420';
const CREAM = '#FFF3E8';
const ROSE = '#F0AAB0';

export const teddy: Theme = {
  id: 'teddy',
  colors: {
    primary: ROSE,
    accent: '#6E403A',
    primaryLight: '#F7CDD0',
    mint: '#A9CDB0',
    background: '#DDBFB2',
    backgroundTop: '#E3C7BA',
    backgroundBottom: '#D6B5A7',
    card: '#F8E8DE',
    cardStrong: '#FFF4EC',
    cardSolid: '#F8E8DE',
    glassBorder: BROWN,
    glassBorderSoft: 'rgba(90,55,47,0.45)',
    text: DARK,
    textSecondary: '#6A4640',
    navy: '#7A4A42',
    navyDeep: '#6B4039',
    navyLight: '#8A5850',
    onNavy: CREAM,
    onNavySecondary: '#F2D9CE',
    navyBorder: '#4A2C27',
    barFrom: '#6E433B',
    barTo: '#6E433B',
    onBar: CREAM,
    navActive: ROSE,
    ringOnNavy: '#F7C4C8',
    trackOnNavy: 'rgba(255,243,232,0.28)',
    onPrimary: DARK,
    onSolid: '#FFFFFF',
    onTile: DARK,
    onNavActive: DARK,
    ring: BROWN,
    danger: '#B03A48',
    success: '#2E6E4E',
    warning: '#7A4A00',
    primaryTint: 'rgba(240,170,176,0.4)',
    mintTint: 'rgba(169,205,176,0.5)',
    warningTint: '#F8E3B8',
    successTint: 'rgba(169,205,176,0.55)',
    separator: 'rgba(90,55,47,0.2)',
    tileTeal: '#B5D3C0',
    tileBlue: '#A9B6DC',
    tileIce: '#F6DDA8',
    tileViolet: '#F0B4B8',
    inputBg: '#FFF6F0',
    track: '#EAD2C6',
    placeholder: '#7A5F58',
  },
  radius: { card: 28, tile: 24, control: 18, pill: 999 },
  lineWidth: 2.2,
  shadow: '0px 0px 0px rgba(0,0,0,0)',
  shadowSmall: '0px 0px 0px rgba(0,0,0,0)',
  shadowInset: '0px 0px 0px rgba(0,0,0,0)',
  chartTones: ['#F0AAB0', '#A9B6DC', '#F6DDA8', '#B5D3C0', '#CDB6DD', '#E9B79A', '#8A5850'],
  categoryColors: { study: '#6F83B8', sport: '#A07DC0', chores: '#D39A3A', personal: '#5E9E78', other: '#9A8078' },
  rewardTints: { gift: '#D9742E', 'gamepad-2': '#7A6BB8', film: '#A07DC0', smartphone: '#6F83B8', cookie: '#C98A3C', star: '#D9A21E', pizza: '#C9505E', popcorn: '#D39A3A', ticket: '#9B7FB8', trophy: '#D9A21E' },
  childSoft: {
    '#1E88F5': '#A9B6DC', '#2EC4A6': '#B5D3C0', '#8B5CF6': '#CDB6DD', '#F5A623': '#F6D494', '#E5484D': '#F0AAB0',
    // couleurs choisies sous le thème « verre givré » : même correspondance
    '#3A7CA5': '#A9B6DC', '#2F8F80': '#B5D3C0', '#6E6BB8': '#CDB6DD', '#B07A28': '#F6D494', '#A83A44': '#F0AAB0',
  },
  childPalette: ['#A9B6DC', '#B5D3C0', '#CDB6DD', '#F6D494', '#F0AAB0'],
  decor: 'teddy',
  browserColor: '#DDBFB2',
};
