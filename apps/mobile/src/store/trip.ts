import { create } from 'zustand';

/**
 * Grand départ (D-107) : étape 2 de la séquence, partagée entre l'onglet Phiêu lưu (qui trace le trajet puis revient sur Hôm nay) et Hôm nay (où le
 * panda quitte la maison par la droite). Affichage seulement : le départ lui-même est déjà accepté par le serveur (`adventure_start`).
 */
export type Departure = { childId: string; destination: string; at: number };
type TripState = {
  departure: Departure | null;
  depart: (d: Departure) => void;
  finish: () => void;
};

export const useTripStore = create<TripState>((set) => ({
  departure: null,
  depart: (departure) => set({ departure }),
  finish: () => set({ departure: null }),
}));
