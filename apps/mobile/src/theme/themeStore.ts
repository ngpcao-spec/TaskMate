/** Natif : pas de rechargement programmable sans module dédié ; il faut rouvrir l'app. */
export const reloadApp = (): 'reloaded' | 'manual' => 'manual';
