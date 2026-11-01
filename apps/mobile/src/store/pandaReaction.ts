import { create } from 'zustand';

/** Durée de la réaction du panda quand l'enfant coche une tâche (expression « très heureux » + « +5 ⚡ »). */
export const REACTION_MS = 2000;

type ReactionState = {
  /** Enfant dont le panda réagit (jamais celui d'un autre enfant). */
  childId: string | null;
  /** Incrémenté à chaque réaction : relance le rebond même si la précédente n'est pas finie. */
  id: number;
  active: boolean;
  trigger: (childId: string) => void;
};

let timer: ReturnType<typeof setTimeout> | undefined;

/** Réaction IMMÉDIATE côté client (même hors ligne) : déclenchée au coche, avant toute réponse du serveur. */
export const usePandaReaction = create<ReactionState>((set, get) => ({
  childId: null,
  id: 0,
  active: false,
  trigger: (childId) => {
    if (timer !== undefined) clearTimeout(timer);
    set({ childId, id: get().id + 1, active: true });
    timer = setTimeout(() => set({ active: false }), REACTION_MS);
  },
}));
