/** Invitation à activer les notifications à l'ouverture de l'app (D-067) — logique pure, testable sans navigateur. */

/** Après « Plus tard », l'invitation revient au bout de 24 h : assez pour ne pas harceler, assez court pour ne pas être oubliée. */
export const SNOOZE_MS = 24 * 60 * 60 * 1000;
export const SNOOZE_KEY = 'taskmate-notif-prompt-snooze-until';

type Status = 'unsupported' | 'needs-install' | 'not-configured' | 'denied' | 'ready' | 'off' | 'on';

/**
 * Afficher l'invitation SEULEMENT quand activer est possible et utile : notifications disponibles sur l'appareil mais pas encore activées
 * (`off`/`ready`). Jamais si déjà activées, refusées par l'utilisateur (on ne harcèle pas : il les rouvre dans les réglages d'iOS),
 * non supportées, ou non configurées. `needs-install` (onglet Safari) est traité par la fiche des réglages, pas ici.
 */
export function shouldPrompt(status: Status, snoozeUntil: number | null, now: number): boolean {
  if (status !== 'off' && status !== 'ready') return false;
  return snoozeUntil === null || !(snoozeUntil > now);
}

/** Lit l'échéance de report enregistrée (valeur absente, illisible ou négative = aucun report). */
export function parseSnooze(raw: string | null): number | null {
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}
