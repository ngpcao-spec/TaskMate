import { useEffect } from 'react';
import { AppState } from 'react-native';
import { touchActivity } from '@/api/activity';
import { shouldPing } from '@/domain/activity-ping';

let lastPing = 0;

/**
 * Signale l'activité du membre à l'ouverture de l'app et à chaque retour au premier plan (D-102), au plus un appel toutes les 10 minutes ici
 * (et une écriture par heure côté base). Silencieux : hors ligne ou en erreur, on réessaiera au prochain retour au premier plan.
 */
export function useActivityPing(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const ping = () => {
      const now = Date.now();
      if (!shouldPing(now, lastPing)) return;
      lastPing = now;
      touchActivity().catch(() => {
        lastPing = 0;
      });
    };
    ping();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') ping();
    });
    return () => subscription.remove();
  }, [enabled]);
}

/** Pour les tests : repart d'un état neuf. */
export const resetActivityPing = (): void => {
  lastPing = 0;
};
