/**
 * Stockage local synchrone côté web (cache des requêtes, file d'écritures hors ligne, préférences).
 * localStorage (synchrone, requis par le persister TanStack) ; repli mémoire si indisponible
 * (navigation privée, rendu statique Node) → l'app fonctionne, sans persistance.
 */
const memory = new Map<string, string>();

function ls(): Storage | null {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
  } catch {
    return null; // accès refusé (cookies bloqués)
  }
}

export const kvStorage = {
  getItem: (key: string): string | null => {
    try {
      return ls()?.getItem(key) ?? memory.get(key) ?? null;
    } catch {
      return memory.get(key) ?? null;
    }
  },
  setItem: (key: string, value: string): void => {
    memory.set(key, value);
    try {
      ls()?.setItem(key, value);
    } catch {
      // quota dépassé : on garde la copie mémoire
    }
  },
  removeItem: (key: string): void => {
    memory.delete(key);
    try {
      ls()?.removeItem(key);
    } catch {
      // ignoré
    }
  },
};
