import { create } from 'zustand';

/**
 * Couleur qui prolonge la vidéo d'accueil sous l'en-tête de Hôm nay enfant (V2, D-106) : posée par l'écran tant qu'il a le focus et que la vidéo
 * est affichée, lue par la barre d'onglets pour prendre la même couleur. `null` = barre normale (crème, coins arrondis).
 */
type HomeSceneState = { color: string | null; setColor: (color: string | null) => void };

export const useHomeScene = create<HomeSceneState>((set) => ({
  color: null,
  setColor: (color) => set({ color }),
}));
