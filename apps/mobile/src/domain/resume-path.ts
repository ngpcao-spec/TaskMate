/**
 * Reprise après rechargement (D-103). Changer de thème recharge l'app (les styles sont calculés au chargement). Sur certains navigateurs — la PWA installée
 * sur iPhone —, un rechargement ouvre la page de DÉPART (Hôm nay) au lieu de la page courante : on mémorise donc la page quelques secondes avant de recharger
 * et on y retourne au démarrage. Aucune donnée : seulement un chemin interne de l'app.
 */
export const RESUME_KEY = 'taskmate-resume-path';
/** Au-delà, la mémoire est périmée (ouverture à froid plus tard) : on l'ignore. */
export const RESUME_MAX_AGE_MS = 60_000;

/** Chemin interne seulement : jamais une adresse externe ni protocole-relative ; la page de départ elle-même n'a rien à reprendre. */
export const isResumablePath = (p: unknown): p is string =>
  typeof p === 'string' && p.length <= 300 && p.startsWith('/') && !p.startsWith('//') && !p.includes('://') && !p.includes('\\') && p !== '/' && !/[\u0000-\u001f]/.test(p);

export const encodeResume = (path: string, now: number): string => JSON.stringify({ path, at: now });

/** Chemin à rouvrir, ou `null` (absent, illisible, périmé, horloge revenue en arrière, chemin non permis). */
export function decodeResume(raw: string | null, now: number): string | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (!isResumablePath(v.path) || typeof v.at !== 'number') return null;
    const age = now - v.at;
    return age >= 0 && age <= RESUME_MAX_AGE_MS ? v.path : null;
  } catch {
    return null;
  }
}
