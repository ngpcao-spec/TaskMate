import { create } from 'zustand';

/** Durée de la réaction du panda quand l'enfant coche une tâche (expression « très heureux » + « +N ⚡ », N = points de la tâche, D-106). */
export const REACTION_MS = 2000;

type ReactionState = {
  /** Enfant dont le panda réagit (jamais celui d'un autre enfant). */
  childId: string | null;
  /** Incrémenté à chaque réaction : relance le rebond même si la précédente n'est pas finie. */
  id: number;
  active: boolean;
  /** Énergie gagnée par ce coche (les points de la tâche) ; 0 = pas de « +N ⚡ ». */
  energy: number;
  trigger: (childId: string, energy: number) => void;
};

let timer: ReturnType<typeof setTimeout> | undefined;

/** Réaction IMMÉDIATE côté client (même hors ligne) : déclenchée au coche, avant toute réponse du serveur. */
export const usePandaReaction = create<ReactionState>((set, get) => ({
  childId: null,
  id: 0,
  active: false,
  energy: 0,
  trigger: (childId, energy) => {
    if (timer !== undefined) clearTimeout(timer);
    set({ childId, id: get().id + 1, active: true, energy: Math.max(0, Math.floor(energy)) });
    timer = setTimeout(() => set({ active: false }), REACTION_MS);
  },
}));
