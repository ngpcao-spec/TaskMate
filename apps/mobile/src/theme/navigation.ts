import { DefaultTheme } from 'expo-router';
import { theme } from './index';

/**
 * Thème de navigation (expo-router) aux couleurs du thème actif. Sans lui, le défaut (fond gris `rgb(242,242,242)`) apparaît
 * derrière les angles arrondis de la barre du bas et sous les écrans empilés.
 */
export const navigationTheme: typeof DefaultTheme = {
  ...DefaultTheme,
  dark: theme.id === 'cosmos',
  colors: {
    ...DefaultTheme.colors,
    primary: theme.colors.primary,
    background: theme.colors.background,
    card: theme.colors.cardSolid,
    text: theme.colors.text,
    border: theme.colors.glassBorder,
    notification: theme.colors.danger,
  },
};
