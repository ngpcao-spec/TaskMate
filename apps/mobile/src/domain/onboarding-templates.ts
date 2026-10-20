import type { RecurrenceFields } from '@/domain/task-form';

/**
 * Modèles de départ de l'étape « Tâches et récompenses » (D-090). Les titres sont des clés i18n (`onboarding.templates.*`), jamais du texte en dur.
 *
 * Points (SPEC §3.4 : défaut 10) : 5 = geste court du quotidien, 10 = habituel, 15 = devoir plus long. Récurrence (SPEC §5.3 : `daily` | `weekdays`) :
 * ce qui se fait tous les jours → quotidienne ; ce qui se fait certains jours → jours choisis (1 = lundi … 7 = dimanche). Le parent peut tout modifier ensuite.
 * Coûts des récompenses : atteignables en quelques jours (≈ 25 à 35 points par jour d'un enfant régulier) — 50, 60, 80, 100.
 */
export type TaskTemplate = {
  key: string;
  category: RecurrenceFields['category'];
  points: number;
  rule: 'daily' | 'weekdays';
  weekdays: number[] | null;
};

export const TASK_TEMPLATES: readonly TaskTemplate[] = [
  { key: 'tidyRoom', category: 'chores', points: 10, rule: 'weekdays', weekdays: [6] },
  { key: 'read20', category: 'study', points: 10, rule: 'daily', weekdays: null },
  { key: 'homework', category: 'study', points: 15, rule: 'weekdays', weekdays: [1, 2, 3, 4, 5] },
  { key: 'brushTeeth', category: 'personal', points: 5, rule: 'daily', weekdays: null },
  { key: 'clearTable', category: 'chores', points: 5, rule: 'daily', weekdays: null },
  { key: 'foldClothes', category: 'chores', points: 5, rule: 'weekdays', weekdays: [7] },
  { key: 'practiceMusic', category: 'personal', points: 10, rule: 'weekdays', weekdays: [1, 3, 5] },
  { key: 'waterPlants', category: 'chores', points: 5, rule: 'weekdays', weekdays: [2, 5] },
];

export type RewardTemplate = { key: string; icon: string; cost: number };

export const REWARD_TEMPLATES: readonly RewardTemplate[] = [
  { key: 'gameTime', icon: 'gamepad-2', cost: 50 },
  { key: 'familyMovie', icon: 'popcorn', cost: 100 },
  { key: 'iceCream', icon: 'cookie', cost: 60 },
  { key: 'weekendMeal', icon: 'pizza', cost: 80 },
];

export type RewardInput = { title: string; icon: string; cost: number; childId: string | null };

/** Valeurs modifiables d'un modèle coché (points / coût), avec bornes de la base (0–1000 pour une tâche, > 0 pour une récompense). */
export const clampPoints = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.min(1000, Math.trunc(n))) : 0);
export const clampCost = (n: number): number => (Number.isFinite(n) ? Math.max(1, Math.min(100000, Math.trunc(n))) : 1);

export type PickedTask = { template: TaskTemplate; title: string; points: number };

/**
 * Séries à créer : une par (enfant × modèle coché), sans heure (`anytime`), débutant le jour LOCAL de la famille. Le serveur matérialise les occurrences
 * (§5.3) ; c'est le flux de création existant (le parent seul crée, jamais l'enfant).
 */
export function taskRecurrences(picks: Readonly<Record<string, readonly PickedTask[]>>, today: string): RecurrenceFields[] {
  const out: RecurrenceFields[] = [];
  for (const [childId, list] of Object.entries(picks)) {
    for (const p of list) {
      out.push({
        child_id: childId,
        title: p.title.trim().slice(0, 80),
        category: p.template.category,
        note: null,
        time_kind: 'anytime',
        start_time: null,
        end_time: null,
        points: clampPoints(p.points),
        rule: p.template.rule,
        weekdays: p.template.rule === 'weekdays' ? [...(p.template.weekdays ?? [])] : null,
        starts_on: today,
      });
    }
  }
  return out.filter((r) => r.title !== '');
}

export type PickedReward = { template: RewardTemplate; title: string; cost: number };

/** Récompenses communes à la famille (`child_id` null), coût modifiable. */
export const rewardInputs = (picks: readonly PickedReward[]): RewardInput[] =>
  picks.filter((p) => p.title.trim() !== '').map((p) => ({ title: p.title.trim().slice(0, 80), icon: p.template.icon, cost: clampCost(p.cost), childId: null }));
