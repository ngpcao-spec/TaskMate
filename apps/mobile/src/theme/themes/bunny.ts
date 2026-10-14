import type { Theme } from './types';

/**
 * Thème « bunny » : fond bleu ciel à motif vichy, cartes blanc crème aux contours bleu-gris, panneaux et barre de navigation bleu poudré, aplats pastel (rose,
 * beurre, ciel, menthe), lapinous cotonneux, fraises, étoiles et nuages. Réf. : docs/mockups/theme-bunny-reference.png (écran d'accueil illustré fourni par Teo).
 * Thème CLAIR : texte bleu-gris foncé partout, y compris sur les panneaux bleu poudré (`onNavy`, `onBar` sont sombres).
 */
const INK = '#4D5A78';
const DARK = '#2F3856';
const PINK = '#F6B4C0';

export const bunny: Theme = {
  id: 'bunny',
  colors: {
    primary: PINK,
    accent: '#4A5A8C',
    primaryLight: '#FAD3DB',
    mint: '#B7E0CB',
    background: '#DCE6F4',
    backgroundTop: '#E4ECF8',
    backgroundBottom: '#D5E1F2',
    card: '#FFFAF6',
    cardStrong: '#FFFFFF',
    cardSolid: '#FFFAF6',
    glassBorder: INK,
    glassBorderSoft: 'rgba(77,90,120,0.4)',
    text: DARK,
    textSecondary: '#4F5A7C',
    navy: '#B9CCEA',
    navyDeep: '#A9BFE4',
    navyLight: '#C7D7EF',
    onNavy: DARK,
    onNavySecondary: '#3E4A72',
    navyBorder: INK,
    barFrom: '#C5D6F0',
    barTo: '#C5D6F0',
    onBar: DARK,
    navActive: '#F8C6CF',
    ringOnNavy: '#E0667F',
    trackOnNavy: 'rgba(255,255,255,0.65)',
    onPrimary: DARK,
    onSolid: '#FFFFFF',
    onTile: DARK,
    onNavActive: DARK,
    ring: INK,
    danger: '#BE3F5B',
    success: '#2F7A5A',
    warning: '#7A4A00',
    primaryTint: '#FBDEE0',
    mintTint: '#D7ECDE',
    warningTint: '#FCEBC0',
    successTint: '#D4EADC',
    separator: 'rgba(77,90,120,0.2)',
    tileTeal: '#C5E6D4',
    tileBlue: '#BCD2F2',
    tileIce: '#FBE9B0',
    tileViolet: '#F9CFD6',
    inputBg: '#FFFFFF',
    track: '#E3EAF6',
    placeholder: '#68728F',
  },
  radius: { card: 28, tile: 24, control: 18, pill: 999 },
  lineWidth: 2.2,
  shadow: '0px 0px 0px rgba(0,0,0,0)',
  shadowSmall: '0px 0px 0px rgba(0,0,0,0)',
  shadowInset: '0px 0px 0px rgba(0,0,0,0)',
  chartTones: ['#F6B4C0', '#9DB9E8', '#FBE08A', '#9ED3B8', '#C9B6E6', '#F4C59B', '#7A8DB8'],
  categoryColors: { study: '#5E7FC4', sport: '#9B7FD0', chores: '#D39A3A', personal: '#4FA683', other: '#8A94AE' },
  rewardTints: { gift: '#E0667F', 'gamepad-2': '#7A6BC4', film: '#9B7FD0', smartphone: '#5E7FC4', cookie: '#D39A3A', star: '#D9A21E', pizza: '#D4505E', popcorn: '#D39A3A', ticket: '#9B7FD0', trophy: '#D9A21E' },
  childSoft: {
    '#1E88F5': '#9DB9E8', '#2EC4A6': '#9ED3B8', '#8B5CF6': '#C9B6E6', '#F5A623': '#F6D494', '#E5484D': '#F6B4C0',
    // couleurs choisies sous le thème « verre givré » : même correspondance
    '#3A7CA5': '#9DB9E8', '#2F8F80': '#9ED3B8', '#6E6BB8': '#C9B6E6', '#B07A28': '#F6D494', '#A83A44': '#F6B4C0',
  },
  childPalette: ['#9DB9E8', '#9ED3B8', '#C9B6E6', '#F6D494', '#F6B4C0'],
  decor: 'bunny',
  browserColor: '#DCE6F4',
};
