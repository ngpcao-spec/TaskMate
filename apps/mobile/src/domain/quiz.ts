/**
 * « Révisions » (D-055) : calculs purs. Le serveur reste l'autorité (clé des réponses, score, validation) ; ces fonctions servent
 * à la saisie (validation avant envoi), à l'affichage (mélange des choix, pourcentages, progression d'UN enfant) et aux tests.
 */

export const MIN_CHOICES = 3;
export const MAX_CHOICES = 4;
export const MAX_PROMPT = 500;
export const MAX_CHOICE = 200;
export const MAX_EXPLANATION = 500;
export const MAX_TITLE = 80;
export const MAX_SUBJECT = 40;

export type QuestionDraft = {
  prompt: string;
  /** Champs saisis (jusqu'à 4) : les champs vides sont ignorés à l'enregistrement. */
  choices: readonly string[];
  /** Position (dans `choices`, telle que saisie) de la bonne réponse ; null = non choisie. */
  correctIndex: number | null;
  explanation: string;
};

export type QuestionError =
  | 'promptRequired'
  | 'promptTooLong'
  | 'choicesCount'
  | 'choiceTooLong'
  | 'duplicateChoices'
  | 'correctRequired'
  | 'correctEmpty'
  | 'explanationTooLong';

export type NormalizedQuestion = { prompt: string; choices: string[]; correct: number; explanation: string | null };

const clean = (s: string) => s.trim();
const sameChoice = (a: string, b: string) => clean(a).toLowerCase() === clean(b).toLowerCase();

/** Nettoie la saisie : champs vides retirés, bonne réponse recalée sur la nouvelle liste. `null` si elle n'est pas valide. */
export function normalizeQuestion(draft: QuestionDraft): NormalizedQuestion | null {
  if (validateQuestion(draft).length > 0) return null;
  const kept: { text: string; original: number }[] = [];
  draft.choices.forEach((c, i) => {
    if (clean(c) !== '') kept.push({ text: clean(c), original: i });
  });
  const correct = kept.findIndex((k) => k.original === draft.correctIndex);
  return { prompt: clean(draft.prompt), choices: kept.map((k) => k.text), correct, explanation: clean(draft.explanation) === '' ? null : clean(draft.explanation) };
}

/** Erreurs de saisie (clés i18n `revisions.errors.*`), miroir des contrôles du serveur. Liste vide = valide. */
export function validateQuestion(draft: QuestionDraft): QuestionError[] {
  const errors: QuestionError[] = [];
  const prompt = clean(draft.prompt);
  if (prompt === '') errors.push('promptRequired');
  else if (prompt.length > MAX_PROMPT) errors.push('promptTooLong');
  const kept = draft.choices.map(clean).filter((c) => c !== '');
  if (kept.length < MIN_CHOICES || draft.choices.length > MAX_CHOICES) errors.push('choicesCount');
  if (kept.some((c) => c.length > MAX_CHOICE)) errors.push('choiceTooLong');
  if (kept.some((c, i) => kept.findIndex((d) => sameChoice(c, d)) !== i)) errors.push('duplicateChoices');
  if (draft.correctIndex === null) errors.push('correctRequired');
  else if (clean(draft.choices[draft.correctIndex] ?? '') === '') errors.push('correctEmpty');
  if (clean(draft.explanation).length > MAX_EXPLANATION) errors.push('explanationTooLong');
  return errors;
}

export type SetTitleError = 'titleRequired' | 'titleTooLong' | 'subjectTooLong';
export function validateSetTitle(title: string, subject: string): SetTitleError[] {
  const errors: SetTitleError[] = [];
  if (clean(title) === '') errors.push('titleRequired');
  else if (clean(title).length > MAX_TITLE) errors.push('titleTooLong');
  if (clean(subject).length > MAX_SUBJECT) errors.push('subjectTooLong');
  return errors;
}

/** Un jeu ne se publie qu'avec au moins une question. */
export const canPublish = (questionCount: number): boolean => questionCount >= 1;

// ───────────── score ─────────────
/** `keys[i]` = bonne réponse de la question i ; `answers[i]` = réponse donnée (null = sans réponse, compte faux). */
export function scoreAnswers(keys: readonly number[], answers: readonly (number | null | undefined)[]): { score: number; total: number } {
  const score = keys.reduce((n, key, i) => n + (answers[i] === key ? 1 : 0), 0);
  return { score, total: keys.length };
}

/** Pourcentage entier (arrondi), 0 si aucune question. */
export const scorePercent = (score: number, total: number): number => (total <= 0 ? 0 : Math.round((score / total) * 100));

// ───────────── mélange des choix ─────────────
function seedFrom(text: string): () => number {
  // xmur3 → mulberry32 : déterministe, sans dépendance
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = (Math.imul(h ^ (h >>> 16), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Permutation de 0…n−1 stable pour une même graine (ex. id de tentative + id de question) : la question ne bouge pas quand on la rouvre. */
export function shuffledOrder(n: number, seed: string): number[] {
  const rand = seedFrom(seed);
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j] as number, order[i] as number];
  }
  return order;
}

/** `order[i]` = indice d'origine du choix affiché en position i. */
export function shuffleChoices(choices: readonly string[], seed: string): { choices: string[]; order: number[] } {
  const order = shuffledOrder(choices.length, seed);
  return { choices: order.map((o) => choices[o] as string), order };
}

/** Indice d'origine (celui que connaît le serveur) du choix touché à l'écran. */
export const originalIndex = (order: readonly number[], displayed: number): number => order[displayed] as number;

// ───────────── liste de questions ─────────────
/** Déplace l'élément `from` en position `to` (copie). Hors bornes : liste inchangée. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return [...list];
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item as T);
  return copy;
}

export const nextPosition = (positions: readonly number[]): number => (positions.length === 0 ? 0 : Math.max(...positions) + 1);

// ───────────── évaluation : envoi ─────────────
export type PlayQuestion = { question_id: string; choices: readonly string[] };

/** Charge utile de `submit_quiz_evaluation` : indices D'ORIGINE (le mélange est défait), null si sans réponse. */
export function answersPayload(questions: readonly PlayQuestion[], chosen: Readonly<Record<string, number | null | undefined>>): { question_id: string; choice: number | null }[] {
  return questions.map((q) => ({ question_id: q.question_id, choice: chosen[q.question_id] ?? null }));
}

export const unansweredCount = (questions: readonly PlayQuestion[], chosen: Readonly<Record<string, number | null | undefined>>): number =>
  questions.filter((q) => chosen[q.question_id] === null || chosen[q.question_id] === undefined).length;

// ───────────── états affichés ─────────────
export type AttemptStatus = 'in_progress' | 'submitted' | 'validated';
/** Évaluation vue par l'enfant : à passer / en cours / en attente du parent / validée (score visible). */
export type EvaluationView = 'todo' | 'in_progress' | 'waiting' | 'validated';
export function evaluationView(status: AttemptStatus | null | undefined): EvaluationView {
  switch (status) {
    case 'in_progress':
      return 'in_progress';
    case 'submitted':
      return 'waiting';
    case 'validated':
      return 'validated';
    default:
      return 'todo';
  }
}

// ───────────── progression d'UN enfant ─────────────
export type HistoryEntry = { id: string; at: string; kind: 'practice' | 'evaluation'; score: number; total: number };
export type HistoryPoint = HistoryEntry & { percent: number };

/** Historique chronologique (anciens d'abord) d'UN enfant ; jamais de comparaison entre enfants. */
export function historySeries(entries: readonly HistoryEntry[], kind?: 'practice' | 'evaluation'): HistoryPoint[] {
  return entries
    .filter((e) => (kind ? e.kind === kind : true))
    .map((e) => ({ ...e, percent: scorePercent(e.score, e.total) }))
    .sort((a, b) => (a.at === b.at ? a.id.localeCompare(b.id) : a.at < b.at ? -1 : 1));
}

/** Écart (points de pourcentage) entre le dernier et l'avant-dernier résultat ; null s'il y en a moins de deux. */
export function lastChange(points: readonly HistoryPoint[]): number | null {
  if (points.length < 2) return null;
  return (points[points.length - 1] as HistoryPoint).percent - (points[points.length - 2] as HistoryPoint).percent;
}

// ───────────── erreurs serveur → message ─────────────
const SERVER_ERRORS: Record<string, string> = {
  no_questions: 'revisions.server.noQuestions',
  set_published: 'revisions.server.setPublished',
  set_has_attempts: 'revisions.server.setHasAttempts',
  evaluation_already_taken: 'revisions.server.evaluationTaken',
  attempt_in_progress: 'revisions.server.attemptInProgress',
  set_not_found: 'revisions.server.setNotFound',
  attempt_closed: 'revisions.server.attemptClosed',
  not_submitted: 'revisions.server.notSubmitted',
  duplicate_choices: 'revisions.errors.duplicateChoices',
  invalid_choices: 'revisions.errors.choicesCount',
  invalid_question: 'revisions.errors.promptRequired',
  invalid_correct: 'revisions.errors.correctRequired',
};

/** Clé i18n du message pour un code d'erreur renvoyé par une RPC de révisions (repli : message générique). */
export const quizErrorKey = (code: string): string => SERVER_ERRORS[code] ?? 'common.error';
