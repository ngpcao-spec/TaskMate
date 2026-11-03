import {
  animEnded,
  applyDayPlan,
  animFailed,
  CURIOUS_GAP_MS,
  firstCheckToday,
  initialPandaAnim,
  PENDING_MAX_MS,
  rememberCheck,
  requestAnim,
  restAsleep,
  sleepPlan,
  wake,
  type PandaAnimState,
  type PandaReaction,
} from './panda-animation';

const ALL = new Set<PandaReaction>(['happy', 'curious', 'sleep']);
const NONE = new Set<PandaReaction>();
const req = (s: PandaAnimState, a: PandaReaction, t: number) => requestAnim(s, a, t, ALL);

describe('panda vidéo : machine d’états (D-106)', () => {
  it('repos → réaction → fin réelle (`ended`) → repos', () => {
    let s = req(initialPandaAnim, 'happy', 0);
    expect(s.current).toBe('happy');
    s = animEnded(s, 'happy', 6000);
    expect(s).toMatchObject({ current: 'idle', asleep: false, pending: null });
    s = req(s, 'curious', 7000);
    expect(s.current).toBe('curious');
    expect(animEnded(s, 'curious', 15000).current).toBe('idle');
  });

  it('une fin qui ne correspond plus à l’animation courante est ignorée', () => {
    const s = req(initialPandaAnim, 'happy', 0);
    expect(animEnded(s, 'curious', 10)).toBe(s);
    expect(animEnded(s, 'idle', 10)).toBe(s);
  });

  it('priorités : un toucher pendant `happy` est ignoré (jamais mis en attente) ; `happy` interrompt `curious`', () => {
    let s = req(initialPandaAnim, 'happy', 0);
    expect(req(s, 'curious', 100)).toBe(s);
    expect(req(s, 'happy', 200)).toBe(s); // même tâche rejouée : pas de double
    s = req(animEnded(s, 'happy', 6000), 'curious', 7500);
    expect(s.current).toBe('curious');
    const h = req(s, 'happy', 7600);
    expect(h.current).toBe('happy');
    expect(h.serial).toBe(s.serial + 1);
  });

  it('`sleep` passe devant tout sauf un `happy` commencé : il démarre à sa fin', () => {
    const c = req(initialPandaAnim, 'curious', 0);
    expect(req(c, 'sleep', 10).current).toBe('sleep');
    let s = req(initialPandaAnim, 'happy', 0);
    s = req(s, 'sleep', 100);
    expect(s.current).toBe('happy');
    expect(s.pending).toEqual({ anim: 'sleep', at: 100 });
    s = animEnded(s, 'happy', 2000);
    expect(s.current).toBe('sleep');
    // pendant le coucher : plus rien ne passe
    expect(req(s, 'happy', 2100)).toBe(s);
    expect(req(s, 'curious', 2100)).toBe(s);
  });

  it('aucune file : une seule attente, remplacée seulement par plus prioritaire, abandonnée après 3 s', () => {
    let s = req(initialPandaAnim, 'happy', 0);
    s = req(s, 'sleep', 0);
    expect(s.pending?.anim).toBe('sleep');
    s = animEnded(s, 'happy', PENDING_MAX_MS + 1);
    expect(s).toMatchObject({ current: 'idle', pending: null });
  });

  it('`sleep` fini : image endormie qui reste ; seul `wake` (décoche, nouveau jour) ramène au repos', () => {
    let s = req(initialPandaAnim, 'sleep', 0);
    s = animEnded(s, 'sleep', 8000);
    expect(s).toMatchObject({ current: 'sleep', asleep: true });
    expect(req(s, 'happy', 9000)).toBe(s);
    expect(req(s, 'curious', 9000)).toBe(s);
    s = wake(s);
    expect(s).toMatchObject({ current: 'idle', asleep: false });
    expect(wake(initialPandaAnim)).toBe(initialPandaAnim);
  });

  it('déjà couché aujourd’hui : image endormie directement, sans vidéo', () => {
    const s = restAsleep(initialPandaAnim);
    expect(s).toMatchObject({ current: 'sleep', asleep: true });
    expect(restAsleep(s)).toBe(s);
  });

  it('vidéo non prête à temps : repos (réaction) ou image endormie (coucher), jamais d’écran noir', () => {
    expect(animFailed(req(initialPandaAnim, 'curious', 0), 'curious', 1500).current).toBe('idle');
    expect(animFailed(req(initialPandaAnim, 'happy', 0), 'happy', 1500).current).toBe('idle');
    expect(animFailed(req(initialPandaAnim, 'sleep', 0), 'sleep', 1500)).toMatchObject({ current: 'sleep', asleep: true });
    expect(animFailed(initialPandaAnim, 'idle', 0)).toBe(initialPandaAnim);
  });

  it('délai minimal de 1 s entre deux `curious`', () => {
    let s = animEnded(req(initialPandaAnim, 'curious', 0), 'curious', 8000);
    expect(req(s, 'curious', 8000 + CURIOUS_GAP_MS - 1)).toBe(s);
    s = req(s, 'curious', 8000 + CURIOUS_GAP_MS);
    expect(s.current).toBe('curious');
  });

  it('stades sans vidéo de réaction : aucun effet', () => {
    for (const a of ['happy', 'curious', 'sleep'] as const) expect(requestAnim(initialPandaAnim, a, 0, NONE)).toBe(initialPandaAnim);
    expect(requestAnim(initialPandaAnim, 'happy', 0, new Set(['curious']))).toBe(initialPandaAnim);
  });
});

describe('panda vidéo : coucher une fois par jour, `happy` une fois par tâche et par jour', () => {
  it('coucher : à jouer, déjà joué (image fixe), ou rien si la journée n’est pas finie', () => {
    expect(sleepPlan(false, null, '2026-11-03')).toBe('none');
    expect(sleepPlan(false, '2026-11-03', '2026-11-03')).toBe('none');
    expect(sleepPlan(true, null, '2026-11-03')).toBe('play');
    expect(sleepPlan(true, '2026-11-02', '2026-11-03')).toBe('play'); // nouveau jour
    expect(sleepPlan(true, '2026-11-03', '2026-11-03')).toBe('still');
  });
  it('coche : la première du jour pour cette tâche seulement ; la mémoire ne garde que le jour courant', () => {
    let seen: string[] = [];
    expect(firstCheckToday(seen, 't1', '2026-11-03')).toBe(true);
    seen = rememberCheck(seen, 't1', '2026-11-03');
    expect(firstCheckToday(seen, 't1', '2026-11-03')).toBe(false); // recochée ou rejouée : pas de double animation
    expect(firstCheckToday(seen, 't2', '2026-11-03')).toBe(true);
    expect(firstCheckToday(seen, 't1', '2026-11-04')).toBe(true); // nouveau jour
    seen = rememberCheck(seen, 't2', '2026-11-04');
    expect(seen).toEqual(['2026-11-04:t2']);
  });
});

describe('panda vidéo : fin de journée appliquée à l’état', () => {
  it('journée finie, coucher pas encore joué : il démarre au repos et pendant `curious`, attend la fin d’un `happy`', () => {
    expect(applyDayPlan(initialPandaAnim, 'play', false, true).current).toBe('sleep');
    expect(applyDayPlan(req(initialPandaAnim, 'curious', 0), 'play', false, true).current).toBe('sleep');
    const happy = req(initialPandaAnim, 'happy', 0);
    expect(applyDayPlan(happy, 'play', false, true)).toBe(happy);
    // fin du `happy` (dernière tâche cochée) : le coucher démarre
    expect(applyDayPlan(animEnded(happy, 'happy', 6000), 'play', false, true).current).toBe('sleep');
  });
  it('déterministe : appliquer deux fois la même règle ne relance rien', () => {
    const once = applyDayPlan(initialPandaAnim, 'play', false, true);
    expect(applyDayPlan(once, 'play', false, true)).toBe(once);
  });
  it('déjà couché aujourd’hui ou images fixes : image endormie directement ; journée pas finie : réveil', () => {
    expect(applyDayPlan(initialPandaAnim, 'still', false, true)).toMatchObject({ current: 'sleep', asleep: true });
    expect(applyDayPlan(initialPandaAnim, 'play', true, true)).toMatchObject({ asleep: true });
    const asleep = applyDayPlan(initialPandaAnim, 'still', false, true);
    expect(applyDayPlan(asleep, 'none', false, true)).toMatchObject({ current: 'idle', asleep: false });
  });
  it('stade sans coucher vidéo : jamais endormi', () => {
    expect(applyDayPlan(initialPandaAnim, 'play', false, false)).toBe(initialPandaAnim);
  });
});
