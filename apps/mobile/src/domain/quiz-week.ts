import { shiftDay, weekDays } from '@/domain/calendar';
import type { AttemptStatus, PlayQuestion } from '@/domain/quiz';

/**
 * « Quiz de la semaine » (D-079) : calculs purs. Les dates sont des JOURS LOCAUX de la famille (`YYYY-MM-DD`), jamais dérivées d'un timestamp UTC :
 * « aujourd'hui » vient de `todayInTz(now, fuseau de la famille)`. Le serveur reste l'autorité ; le retard est une INFORMATION et ne bloque jamais l'enfant.
 */

/** Date limite proposée par défaut à la publication : le dimanche SUIVANT (si aujourd'hui est dimanche : dimanche prochain). */
export function defaultDueOn(today: string): string {
  const sunday = weekDays(today)[6] as string;
  return sunday === today ? shiftDay(today, 7) : sunday;
}

/** Vrai si la date limite est PASSÉE (strictement : le jour de la date limite, le quiz est encore dans les temps). Pas de date limite : jamais en retard. */
export const isPastDue = (dueOn: string | null | undefined, today: string): boolean => !!dueOn && today > dueOn;

export type QuizWeekState = 'not_started' | 'in_progress' | 'late' | 'submitted' | 'validated';
export type QuizWeekInput = {
  dueOn: string | null | undefined;
  today: string;
  /** Dernière tentative de l'enfant sur ce jeu (null = pas commencé). */
  attemptStatus: AttemptStatus | null | undefined;
  /** Réponses déjà enregistrées (tentative en cours). */
  answered: number;
  total: number;
};
export type QuizWeekStatus = {
  state: QuizWeekState;
  /** « En retard » : date limite passée ET quiz pas encore envoyé (pas commencé ou en cours). */
  late: boolean;
  /** Réponses déjà données, à afficher (« 12 sur 20 ») : seulement pour une tentative en cours. */
  progress: { answered: number; total: number } | null;
};

/** Statut pour le PARENT, par quiz et par enfant : Pas commencé / En cours (n sur N) / Envoyé / En retard (+ Validé). Information seulement. */
export function quizWeekStatus(i: QuizWeekInput): QuizWeekStatus {
  if (i.attemptStatus === 'validated') return { state: 'validated', late: false, progress: null };
  if (i.attemptStatus === 'submitted') return { state: 'submitted', late: false, progress: null };
  const inProgress = i.attemptStatus === 'in_progress';
  const late = isPastDue(i.dueOn, i.today);
  const progress = inProgress ? { answered: Math.max(0, Math.min(i.answered, i.total)), total: i.total } : null;
  return { state: late ? 'late' : inProgress ? 'in_progress' : 'not_started', late, progress };
}

/** Réponses déjà enregistrées → état local de l'écran (positions AFFICHÉES). Ignore toute question inconnue ou position hors choix. */
export function restoredAnswers(questions: readonly PlayQuestion[], saved: readonly { question_id: string; choice: number }[]): Record<string, number> {
  const byId = new Map(questions.map((q) => [q.question_id, q]));
  const out: Record<string, number> = {};
  for (const s of saved) {
    const q = byId.get(s.question_id);
    if (q && Number.isInteger(s.choice) && s.choice >= 0 && s.choice < q.choices.length) out[s.question_id] = s.choice;
  }
  return out;
}
