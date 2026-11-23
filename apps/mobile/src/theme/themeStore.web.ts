import { encodeResume, RESUME_KEY } from '@/domain/resume-path';

/** Web : recharge l'app (écran d'erreur « Tải lại »). La page courante est mémorisée avant : la PWA iPhone repart sinon de la page de départ (D-103). */
export const reloadApp = (): 'reloaded' | 'manual' => {
  try {
    try {
      globalThis.localStorage?.setItem(RESUME_KEY, encodeResume(globalThis.location.pathname + globalThis.location.search, Date.now()));
    } catch {
      // stockage indisponible : le rechargement a lieu quand même
    }
    globalThis.location.reload();
    return 'reloaded';
  } catch {
    return 'manual';
  }
};
