import { decodeResume, isStartPath, RESUME_KEY, RESUME_WINDOW_MS } from '@/domain/resume-path';

type Pending = { target: string; loadedAt: number };

/**
 * Lue ET EFFACÉE au chargement de la page (jamais plus tard : une mémoire oubliée ne doit pas rouvrir une vieille page au milieu d'un parcours).
 * Elle ne vaut que si la page a été chargée à l'adresse de départ : sinon le navigateur est bien revenu où il fallait.
 */
function readPending(now: number): Pending | null {
  try {
    const raw = globalThis.localStorage?.getItem(RESUME_KEY) ?? null;
    if (raw === null) return null;
    globalThis.localStorage.removeItem(RESUME_KEY);
    const target = decodeResume(raw, now);
    return target !== null && isStartPath(globalThis.location?.pathname) ? { target, loadedAt: now } : null;
  } catch {
    return null;
  }
}

let pending: Pending | null = readPending(Date.now());

/** Page à rouvrir (une seule fois, et seulement peu après le chargement), ou `null`. */
export function takeResume(now: number = Date.now()): string | null {
  const p = pending;
  pending = null;
  return p !== null && now - p.loadedAt >= 0 && now - p.loadedAt <= RESUME_WINDOW_MS ? p.target : null;
}

/** Pour les tests : relit la mémoire comme au chargement d'une page. */
export function reloadPendingForTest(now: number = Date.now()): void {
  pending = readPending(now);
}
