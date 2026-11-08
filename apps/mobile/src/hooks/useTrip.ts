import { useCallback, useEffect, useState } from 'react';
import type { CollectResult } from '@/api/adventure';
import type { AdventureState } from '@/domain/adventure';
import { parseTripMemory, rememberEntered, rememberOpened, returnStep, tripView, type TripMemory, type TripView } from '@/domain/adventure-trip';
import { kvStorage } from '@/sync/storage';
import { useCollectAdventure } from './useAdventure';

const KEY = (childId: string) => `taskmate-trip:${childId}`;
function readMemory(childId: string | null): TripMemory {
  if (!childId) return parseTripMemory(null);
  try {
    return parseTripMemory(kvStorage.getItem(KEY(childId)));
  } catch {
    return parseTripMemory(null);
  }
}
function writeMemory(childId: string, m: TripMemory): void {
  try {
    kvStorage.setItem(KEY(childId), JSON.stringify(m));
  } catch {
    // stockage indisponible : au pire, l'entrée du panda se rejoue
  }
}

export type TripReveal = { adventureId: string } & CollectResult;

export type Trip = {
  view: TripView;
  /** retour : `enter` (le panda entre par la gauche), `gift` (il attend au centre avec le paquet fermé) ; `null` hors retour */
  step: 'enter' | 'gift' | null;
  /** aventure rentrée (paquet à ouvrir) */
  backId: string | null;
  /** paquet touché, résultat pas encore reçu (hors ligne : « Đang chờ kết nối… ») */
  opening: boolean;
  /** trouvaille affichée (paquet ouvert) jusqu'à « Cất vào sổ » */
  reveal: TripReveal | null;
  markEntered: () => void;
  openGift: () => void;
  store: () => void;
};

/**
 * Retour d'aventure sur Hôm nay (V2, D-107). Mémoire locale par enfant et par aventure (`kvStorage`) : l'entrée du panda se joue une seule fois, le
 * paquet ouvert ne se rouvre jamais. `adventure_collect` part par la file `writes` (id = celui de l'aventure : rejouable, le SERVEUR tire la
 * trouvaille) ; aucun résultat inventé hors ligne. Une ouverture faite ailleurs (autre appareil, envoi rejoué après redémarrage) est montrée une fois
 * grâce à `last` de `adventure_state`.
 */
export function useTrip(childId: string | null, adventure: AdventureState | undefined): Trip {
  const collect = useCollectAdventure();
  const [memory, setMemory] = useState<TripMemory>(() => readMemory(childId));
  const [memoryFor, setMemoryFor] = useState(childId);
  const [opening, setOpening] = useState<string | null>(null);
  const [reveal, setReveal] = useState<TripReveal | null>(null);
  if (memoryFor !== childId) {
    setMemoryFor(childId);
    setMemory(readMemory(childId));
    setOpening(null);
    setReveal(null);
  }
  const save = useCallback((next: TripMemory) => setMemory(next), []);
  // la mémoire de l'appareil suit l'état (écriture seule : synchronisation vers le stockage)
  useEffect(() => {
    if (childId && memoryFor === childId) writeMemory(childId, memory);
  }, [childId, memoryFor, memory]);

  const backId = adventure?.state === 'back' && adventure.active ? adventure.active.id : null;
  const last = adventure?.last ?? null;

  // résultat reçu (cette ouverture, ou une ouverture rejouée / faite ailleurs pour une aventure dont l'entrée a été vue ici)
  const fromCollect = opening && collect.data && collect.variables?.adventureId === opening ? { adventureId: opening, ...collect.data } : null;
  const fromLast =
    !reveal && last && adventure?.state !== 'back' && (last.id === opening || (memory.entered.includes(last.id) && !memory.opened.includes(last.id)))
      ? { adventureId: last.id, discoverySlug: last.discoverySlug, duplicate: last.duplicate, destination: last.destination }
      : null;
  const result = fromCollect ?? fromLast;
  // résultat arrivé : paquet ouvert, mémorisé (calculé au rendu, sans effet)
  if (result && !reveal) {
    setMemory(rememberOpened(memory, result.adventureId));
    setReveal(result);
    setOpening(null);
  }

  const markEntered = useCallback(() => {
    if (backId) save(rememberEntered(memory, backId));
  }, [backId, memory, save]);
  const openGift = useCallback(() => {
    if (!childId || !backId || opening) return;
    save(rememberEntered(memory, backId));
    setOpening(backId);
    collect.mutate({ childId, adventureId: backId }, { onError: () => setOpening(null) }); // refus : message doux (toast), le paquet reste fermé
  }, [childId, backId, opening, memory, save, collect]);
  const store = useCallback(() => setReveal(null), []);

  const view = tripView(adventure, memory, reveal?.adventureId ?? null);
  const step = view === 'back' && backId ? returnStep(backId, memory) : null;
  return { view, step: step === 'done' ? null : step, backId, opening: opening !== null, reveal, markEntered, openGift, store };
}
