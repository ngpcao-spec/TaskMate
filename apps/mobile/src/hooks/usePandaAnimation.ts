import { useCallback, useMemo, useState } from 'react';
import {
  animEnded,
  animFailed,
  applyDayPlan,
  firstCheckToday,
  initialPandaAnim,
  rememberCheck,
  requestAnim,
  sleepPlan,
  type PandaAnim,
  type PandaAnimState,
} from '@/domain/panda-animation';
import { kvStorage } from '@/sync/storage';
import type { HomeClip } from '@/v2/components/HomeVideo';
import { availableReactions, homeReactionsForStage, type HomeReactions } from '@/v2/video';

/** Mémoire locale (par enfant) : jour du dernier coucher joué, coches déjà célébrées aujourd'hui. Lecture et écriture protégées (try/catch). */
const SLEEP_KEY = (childId: string) => `taskmate-panda-sleep:${childId}`;
const HAPPY_KEY = (childId: string) => `taskmate-panda-happy:${childId}`;

function read(key: string): string | null {
  try {
    return kvStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string): void {
  try {
    kvStorage.setItem(key, value);
  } catch {
    // stockage indisponible : l'animation pourra rejouer, rien de grave
  }
}
function readSeen(childId: string): string[] {
  try {
    const v = JSON.parse(read(HAPPY_KEY(childId)) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export type PandaAnimation = {
  /** réactions vidéo de ce stade (`null` : aucune, comportement d'avant) */
  reactions: HomeReactions | null;
  state: PandaAnimState;
  /** vidéo à jouer (réaction en cours) ; `null` = repos */
  clip: HomeClip | null;
  /** image fixe à la place de toute vidéo (panda endormi en images fixes, ou sans vidéo de sommeil en boucle) */
  still: unknown;
  /** image de l'aperçu sous la vidéo : le panda endormi quand il dort (jamais le panda éveillé si la boucle ne joue pas) */
  poster: unknown;
  /** coche ACCEPTÉE localement par l'enfant : `happy`, une fois par tâche et par jour */
  onChecked: (taskId: string) => void;
  /** toucher du panda : `curious` */
  onTouched: () => void;
  onEnded: (name: PandaAnim) => void;
  onFailed: (name: PandaAnim) => void;
};

/**
 * Gestionnaire unique des animations du panda vidéo (D-106) : branche la machine d'états pure (`domain/panda-animation`) sur Hôm nay.
 * `mode` : `video` (réactions jouées), `still` (moins d'animations, économie de données, hors ligne : images fixes seulement), `off` (pas de
 * panda vidéo). `dayDone` = fin de journée EXISTANTE (`dayComplete` : ≥ 1 tâche, toutes cochées). Le coucher se joue une fois par enfant et par
 * jour local ; ensuite (même jour) l'image endormie s'affiche directement ; une tâche décochée ou un nouveau jour réveille le panda.
 * Aucun effet : la fin de journée est une règle pure (`applyDayPlan`) appliquée au rendu et avant chaque événement.
 */
export function usePandaAnimation(o: {
  childId: string | null;
  stage: number;
  today: string;
  dayDone: boolean;
  /** tâches chargées : avant, « journée pas finie » ne veut rien dire (sinon chaque ouverture ressemblerait à une fin de journée) */
  ready?: boolean;
  mode: 'video' | 'still' | 'off';
  /** D-107 : jauge d'aventure pleine : le panda ne s'endort pas (il attend le départ) */
  gaugeFull?: boolean;
}): PandaAnimation {
  const { childId, stage, today, dayDone, mode } = o;
  const gaugeFull = o.gaugeFull ?? false;
  const ready = o.ready ?? true;
  const reactions = mode === 'off' ? null : homeReactionsForStage(stage);
  const available = useMemo(() => (mode === 'video' ? availableReactions(reactions) : new Set<never>()), [mode, reactions]);
  const canSleep = !!childId && availableReactions(reactions).has('sleep');
  const [base, setBase] = useState<PandaAnimState>(initialPandaAnim);
  // relu à chaque rendu (localStorage, peu coûteux) ; `version` force un rendu après écriture
  const [, setVersion] = useState(0);
  const playedOn = childId ? read(SLEEP_KEY(childId)) : null;
  // journée finie SOUS LES YEUX de l'enfant (dernière tâche cochée, écran ouvert) : le coucher se rejoue, même s'il a déjà été joué aujourd'hui
  // (tâche décochée puis recochée). La règle « une fois par jour » ne vaut que pour un nouvel affichage de l'écran.
  const [watch, setWatch] = useState<{ day: string; done: boolean | null; live: boolean }>({ day: today, done: null, live: false });
  let live = watch.day === today && watch.live;
  if (ready && (watch.day !== today || watch.done !== dayDone)) {
    live = watch.day === today && (watch.done === false && dayDone ? true : dayDone && watch.live);
    setWatch({ day: today, done: dayDone, live });
  }
  const plan = sleepPlan(dayDone, live ? null : playedOn, today, gaugeFull);
  const stillsOnly = mode === 'still';
  const apply = useCallback((s: PandaAnimState) => applyDayPlan(s, plan, stillsOnly, canSleep), [plan, stillsOnly, canSleep]);
  const state = apply(base);

  const markSlept = useCallback(() => {
    if (!childId) return;
    write(SLEEP_KEY(childId), today);
    setVersion((v) => v + 1);
  }, [childId, today]);

  const onChecked = useCallback(
    (taskId: string) => {
      if (!childId || !available.has('happy')) return;
      const seen = readSeen(childId);
      if (!firstCheckToday(seen, taskId, today)) return;
      write(HAPPY_KEY(childId), JSON.stringify(rememberCheck(seen, taskId, today)));
      setBase((s) => requestAnim(apply(s), 'happy', Date.now(), available));
    },
    [childId, available, today, apply],
  );
  const onTouched = useCallback(() => setBase((s) => requestAnim(apply(s), 'curious', Date.now(), available)), [available, apply]);
  const onEnded = useCallback(
    (name: PandaAnim) => {
      if (name === 'sleep') markSlept();
      setBase((s) => animEnded(apply(s), name, Date.now()));
    },
    [apply, markSlept],
  );
  const onFailed = useCallback(
    (name: PandaAnim) => {
      // coucher impossible à jouer (lecture refusée…) : image endormie, et on ne retente pas ce jour-là
      if (name === 'sleep') markSlept();
      setBase((s) => animFailed(apply(s), name, Date.now()));
    },
    [apply, markSlept],
  );

  const current = state.current;
  const reaction = current === 'idle' || state.asleep ? undefined : reactions?.[current];
  // endormi : la vidéo du sommeil en boucle (le panda RESTE endormi) ; en images fixes ou sans boucle, l'image du panda endormi
  const loop = state.asleep && mode === 'video' ? reactions?.sleepLoop : undefined;
  const clip: HomeClip | null = loop
    ? { name: 'sleep', key: loop.key, sources: loop.sources, loop: true, serial: 0 }
    : reaction
      ? { name: current, key: reaction.key, sources: reaction.sources, loop: false, serial: state.serial }
      : null;
  const sleeping = state.asleep && reactions?.sleepEnd ? reactions.sleepEnd : undefined;
  const still = loop ? undefined : sleeping;
  return { reactions, state, clip, still, poster: sleeping, onChecked, onTouched, onEnded, onFailed };
}
