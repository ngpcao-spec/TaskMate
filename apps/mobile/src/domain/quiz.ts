/**
 * « Révisions » (D-055) : calculs purs. Le serveur reste l'autorité (clé des réponses, score, validation) ; ces fonctions servent
 * à la saisie (validation avant envoi), à l'affichage (pourcentages, progression d'UN enfant). Le mélange des questions et des choix est décidé par le serveur et aux tests.
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

/** Charge utile de `submit_quiz_evaluation` : positions AFFICHÉES (le serveur seul connaît l'ordre d'origine), null si sans réponse. */
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
export type HistoryEntry = { id: string; at: string; score: number; total: number };
export type HistoryPoint = HistoryEntry & { percent: number };

/** Historique chronologique (anciens d'abord) d'UN enfant ; jamais de comparaison entre enfants. */
export function historySeries(entries: readonly HistoryEntry[]): HistoryPoint[] {
  return entries
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
  answers_to_verify: 'revisions.server.answersToVerify',
  answers_not_confirmed: 'revisions.server.answersNotConfirmed',
  invalid_number: 'revisions.errors.promptRequired',
  invalid_kind: 'common.error',
  duplicate_choices: 'revisions.errors.duplicateChoices',
  invalid_choices: 'revisions.errors.choicesCount',
  invalid_question: 'revisions.errors.promptRequired',
  invalid_correct: 'revisions.errors.correctRequired',
};

/** Clé i18n du message pour un code d'erreur renvoyé par une RPC de révisions (repli : message générique). */
export const quizErrorKey = (code: string): string => SERVER_ERRORS[code] ?? 'common.error';

// ───────────── supports multiples (D-061) : grille « Đáp án » et règle de publication ─────────────
export const LETTERS = ['A', 'B', 'C', 'D'] as const;
export const letterOf = (index: number): string => LETTERS[index] ?? '?';

/** Types « examen » : leurs réponses doivent toutes être confirmées avant publication (la base le refuse sinon). */
export const isExamSet = (kind: string): boolean => kind === 'exam' || kind === 'exam_key';

type GridQuestion = { id: string; position: number; origin_number: number | null };
/** Ordre de la grille : par numéro d'origine (les questions sans numéro à la suite, dans l'ordre de saisie). */
export function gridOrder<T extends GridQuestion>(questions: readonly T[]): T[] {
  return [...questions].sort((a, b) => {
    if (a.origin_number !== null && b.origin_number !== null) return a.origin_number - b.origin_number || a.position - b.position;
    if (a.origin_number !== null) return -1;
    if (b.origin_number !== null) return 1;
    return a.position - b.position || a.id.localeCompare(b.id);
  });
}

/** Ce qui empêche de publier (miroir de `set_quiz_status`, qui reste l'autorité) : réponses « à vérifier » non levées, puis, pour un examen, réponses non confirmées. */
export function publishBlockers(kind: string, questions: readonly { to_verify: boolean; confirmed: boolean }[]): { toVerify: number; unconfirmed: number; blocked: boolean } {
  const toVerify = questions.filter((q) => q.to_verify).length;
  const unconfirmed = isExamSet(kind) ? questions.filter((q) => !q.confirmed).length : 0;
  return { toVerify, unconfirmed, blocked: toVerify > 0 || unconfirmed > 0 };
}

// ───────────── support papier et feuille de réponses (D-062) ─────────────
/** Mode de réponse de l'enfant : à l'écran (parcours habituel), papier avec énoncés, ou feuille de réponses seule (numéros et lettres). */
export type PaperMode = 'screen' | 'paper' | 'sheet';
export const PAPER_MODES: readonly PaperMode[] = ['screen', 'paper', 'sheet'];

export const paperModeOf = (s: { paper_support: boolean; answer_sheet_only: boolean }): PaperMode => (!s.paper_support ? 'screen' : s.answer_sheet_only ? 'sheet' : 'paper');
/** Réglages envoyés au serveur pour un mode (« feuille seule » implique le papier). */
export const paperFlags = (mode: PaperMode): { paper: boolean; sheetOnly: boolean } => ({ paper: mode !== 'screen', sheetOnly: mode === 'sheet' });

/** Numéro affiché : celui de la feuille, sinon « #rang » (jamais un nombre nu, qui pourrait être pris pour un vrai numéro de la feuille). */
export const questionTag = (origin: number | null | undefined, index: number): string => (origin === null || origin === undefined ? `#${index + 1}` : String(origin));

/** Questions déjà répondues (positions affichées) : sert à la progression de la feuille. */
export const answeredCount = (questions: readonly PlayQuestion[], chosen: Readonly<Record<string, number | null | undefined>>): number => questions.length - unansweredCount(questions, chosen);
