/** Intervalle minimal entre deux appels depuis cet appareil (la base, elle, n'écrit qu'une fois par heure : D-102). */
export const PING_MIN_GAP_MS = 10 * 60_000;

/** Faut-il signaler l'activité maintenant ? `last` = instant du dernier appel réussi ou tenté (0 = jamais). */
export const shouldPing = (now: number, last: number): boolean => last === 0 || now - last >= PING_MIN_GAP_MS || now < last;
