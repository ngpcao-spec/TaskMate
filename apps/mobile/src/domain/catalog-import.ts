import { isCountry, normalizeGradeFor, SUBJECTS, type Country, type Subject } from '@/domain/catalog';

/**
 * Import d'administration « un seul fichier » (D-081) : lecture DÉTERMINISTE, sans IA, d'un texte (Word / PDF) où chaque QCM commence par `[QUIZ]`, suivi de son
 * en-tête (Pays, Classe, Matière, Semaine, Titre, Ouverture, Échéance) puis de ses questions (« 1. … », A. à D., « Đáp án: B », « Giải thích: … Nguồn: … »).
 * Tout est validé AVANT toute écriture : une seule erreur et rien n'est écrit (tout ou rien). Les erreurs portent le bloc et le numéro de ligne.
 */

export const IMPORT_LIMITS = { maxQuestions: 30, maxPrompt: 500, maxChoice: 200, maxExplanation: 500, maxSource: 200, maxWeek: 40, maxTitle: 80 } as const;

export type ImportErrorCode =
  | 'unknown_header' | 'missing_header' | 'invalid_country' | 'invalid_grade' | 'invalid_subject' | 'week_too_long' | 'title_too_long' | 'invalid_date' | 'dates_pair' | 'dates_order'
  | 'no_questions' | 'too_many_questions' | 'prompt_empty' | 'prompt_too_long' | 'choice_count' | 'choice_empty' | 'choice_too_long' | 'duplicate_choice' | 'missing_answer'
  | 'invalid_answer' | 'explanation_too_long' | 'source_too_long' | 'duplicate_number' | 'duplicate_slot' | 'unexpected_line';
export type ImportError = { code: ImportErrorCode; /** Numéro de ligne (à partir de 1) du texte lu. */ line: number; /** Numéro du bloc [QUIZ] (à partir de 1) ; 0 pour une erreur hors bloc. */ block: number; params?: Record<string, string | number> };

export type ParsedQuestion = { number: number; prompt: string; choices: string[]; correct: number; explanation: string | null; source: string | null; line: number };
export type ParsedQuiz = {
  /** Numéro du bloc [QUIZ] et ligne de son marqueur (affichage). */
  block: number;
  line: number;
  country: Country;
  grade: string;
  subject: Subject;
  week: string;
  title: string;
  releaseOn: string | null;
  dueOn: string | null;
  questions: ParsedQuestion[];
};
export type ImportParse = { structured: false } | { structured: true; ok: true; quizzes: ParsedQuiz[] } | { structured: true; ok: false; errors: ImportError[] };

// ───────────── aides ─────────────
/** Minuscules sans accents (đ → d) : pour reconnaître les clés et les valeurs quelle que soit la langue ou la graphie. */
export const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
const compact = (s: string): string => fold(s).replace(/[^a-z0-9]/g, '');

const HEADER_KEYS: Record<string, 'country' | 'grade' | 'subject' | 'week' | 'title' | 'open' | 'due'> = {
  pays: 'country', quocgia: 'country', country: 'country', nuoc: 'country',
  classe: 'grade', lop: 'grade', grade: 'grade', class: 'grade', niveau: 'grade',
  matiere: 'subject', mon: 'subject', monhoc: 'subject', subject: 'subject',
  semaine: 'week', tuan: 'week', week: 'week',
  titre: 'title', title: 'title', tieude: 'title', ten: 'title',
  ouverture: 'open', open: 'open', release: 'open', tungay: 'open', debut: 'open', miseadisposition: 'open',
  echeance: 'due', due: 'due', denngay: 'due', fin: 'due', hannop: 'due',
};
const COUNTRY_VALUES: Record<string, Country> = { vn: 'VN', vietnam: 'VN', vietnamese: 'VN', viet: 'VN', fr: 'FR', france: 'FR', phap: 'FR', french: 'FR' };
const SUBJECT_VALUES: Record<string, Subject> = {
  histgeo: 'hist_geo', histoiregeographie: 'hist_geo', histoiregeo: 'hist_geo', histgeographie: 'hist_geo', lichsuvadialy: 'hist_geo', lichsudialy: 'hist_geo', historygeography: 'hist_geo', historyandgeography: 'hist_geo',
  maths: 'maths', math: 'maths', mathematiques: 'maths', mathematique: 'maths', mathematics: 'maths', toan: 'maths',
  languenationale: 'langue_nationale', langue: 'langue_nationale', tiengviet: 'langue_nationale', francais: 'langue_nationale', nationallanguage: 'langue_nationale',
  anglais: 'anglais', english: 'anglais', tienganh: 'anglais',
  sciences: 'sciences', science: 'sciences', khoahoc: 'sciences',
  civics: 'civics', giaoduccongdan: 'civics', gdcd: 'civics', educationcivique: 'civics', emc: 'civics',
  technology: 'technology', technologie: 'technology', congnghe: 'technology',
};
// toute matière de la liste fixe est reconnue par sa clé
for (const s of SUBJECTS) SUBJECT_VALUES[compact(s)] = s;

const MARKER = /^\s*\[\s*quiz\s*\]\s*$/i;
const QUESTION_START = /^\s*(\d{1,3})\s*[.)]\s*(.*)$/;
const CHOICE = /^\s*([A-Da-d])\s*[.)]\s*(.*)$/;
/** Une 5e lettre (« E. … ») est un choix de trop : repérée pour être signalée plutôt que collée au choix D. */
const EXTRA_CHOICE = /^\s*([E-Ze-z])\s*[.)]\s+(.*)$/;
const ANSWER_KEYS = new Set(['dapan', 'answer', 'reponse', 'correctanswer', 'bonnereponse']);
const EXPLANATION_KEYS = new Set(['giaithich', 'explication', 'explanation']);
const SOURCE_KEYS = new Set(['nguon', 'source']);

/** `Clé : valeur` (deux-points ordinaire ou pleine chasse) → [clé repliée, valeur d'origine] ; null si la ligne n'a pas cette forme. */
function keyValue(line: string): [string, string] | null {
  const m = /^\s*([^:：]{1,40}?)\s*[:：]\s*(.*)$/.exec(line);
  return m ? [compact(m[1] as string), (m[2] as string).trim()] : null;
}

/** Date AAAA-MM-JJ réelle (jour local, jamais un instant) comprise entre 2020 et 2100 (mêmes bornes que la base). */
export function isIsoDay(v: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d && y >= 2020 && y <= 2100;
}

/** Sépare « explication. Nguồn: référence » : la DERNIÈRE mention « Nguồn: » / « Source: » devient la source. */
export function splitSource(text: string): { explanation: string; source: string | null } {
  let cut = -1;
  let valueFrom = -1;
  for (const m of text.matchAll(/(?<![\p{L}\p{N}])(?:ngu[oồ]n|nguồn|sources?)\s*[:：]\s*/giu)) {
    cut = m.index ?? -1;
    valueFrom = cut + m[0].length;
  }
  if (cut < 0) return { explanation: text.trim(), source: null };
  const source = text.slice(valueFrom).trim();
  return { explanation: text.slice(0, cut).trim(), source: source === '' ? null : source };
}

type Draft = {
  number: number;
  line: number;
  prompt: string[];
  choices: { letter: string; text: string }[];
  answer: string | null;
  answerLine: number;
  explanation: string[] | null;
  source: string | null;
  stage: 'prompt' | 'choices' | 'answer' | 'explanation';
};

// ───────────── lecture ─────────────
export function parseCatalogImport(input: string): ImportParse {
  const lines = input.replace(/\r\n?/g, '\n').replace(/[\u2028\u2029\u000b\u000c]/g, '\n').split('\n');
  const markers: number[] = [];
  lines.forEach((l, i) => { if (MARKER.test(l)) markers.push(i); });
  if (markers.length === 0) return { structured: false };

  const errors: ImportError[] = [];
  const quizzes: ParsedQuiz[] = [];
  markers.forEach((start, b) => {
    const end = b + 1 < markers.length ? (markers[b + 1] as number) : lines.length;
    const quiz = parseBlock(lines, start, end, b + 1, errors);
    if (quiz) quizzes.push(quiz);
  });

  // une case (pays, classe, matière, semaine) ne peut apparaître qu'une fois dans le fichier
  const seen = new Map<string, ParsedQuiz>();
  for (const q of quizzes) {
    const key = [q.country, q.grade, q.subject, fold(q.week).replace(/\s+/g, ' ').trim()].join('|');
    const first = seen.get(key);
    if (first) errors.push({ code: 'duplicate_slot', line: q.line, block: q.block, params: { other: first.block, otherLine: first.line } });
    else seen.set(key, q);
  }
  if (errors.length > 0) return { structured: true, ok: false, errors: errors.sort((a, b) => a.line - b.line) };
  return { structured: true, ok: true, quizzes };
}

function parseBlock(lines: string[], start: number, end: number, block: number, errors: ImportError[]): ParsedQuiz | null {
  const before = errors.length;
  const add = (code: ImportErrorCode, line: number, params?: Record<string, string | number>) => errors.push({ code, line: line + 1, block, ...(params ? { params } : {}) });

  // ── en-tête : « Clé : valeur » jusqu'à la première question
  const header: Partial<Record<'country' | 'grade' | 'subject' | 'week' | 'title' | 'open' | 'due', { value: string; line: number }>> = {};
  let i = start + 1;
  for (; i < end; i++) {
    const raw = lines[i] as string;
    if (raw.trim() === '') continue;
    if (QUESTION_START.test(raw)) break;
    const kv = keyValue(raw);
    const key = kv ? HEADER_KEYS[kv[0]] : undefined;
    if (!kv || !key) {
      add('unknown_header', i, { text: raw.trim().slice(0, 60) });
      continue;
    }
    header[key] = { value: kv[1], line: i };
  }

  // ── validation de l'en-tête
  for (const k of ['country', 'grade', 'subject', 'week', 'title'] as const) {
    if (!header[k] || header[k]?.value === '') add('missing_header', start, { key: k });
  }
  let country: Country | null = null;
  if (header.country?.value) {
    const c = COUNTRY_VALUES[compact(header.country.value)];
    if (c && isCountry(c)) country = c;
    else add('invalid_country', header.country.line, { value: header.country.value });
  }
  let grade: string | null = null;
  if (header.grade?.value && country) {
    grade = normalizeGradeFor(country, header.grade.value);
    if (!grade) add('invalid_grade', header.grade.line, { value: header.grade.value, country });
  }
  let subject: Subject | null = null;
  if (header.subject?.value) {
    subject = SUBJECT_VALUES[compact(header.subject.value)] ?? null;
    if (!subject) add('invalid_subject', header.subject.line, { value: header.subject.value });
  }
  const week = header.week?.value.trim() ?? '';
  if (week.length > IMPORT_LIMITS.maxWeek) add('week_too_long', header.week?.line ?? start, { max: IMPORT_LIMITS.maxWeek });
  const title = header.title?.value.trim() ?? '';
  if (title.length > IMPORT_LIMITS.maxTitle) add('title_too_long', header.title?.line ?? start, { max: IMPORT_LIMITS.maxTitle });
  let releaseOn: string | null = null;
  let dueOn: string | null = null;
  for (const [k, set] of [['open', (v: string) => { releaseOn = v; }], ['due', (v: string) => { dueOn = v; }]] as const) {
    const h = header[k];
    if (!h || h.value === '') continue;
    if (isIsoDay(h.value)) set(h.value);
    else add('invalid_date', h.line, { value: h.value });
  }
  const given = (['open', 'due'] as const).filter((k) => header[k] && header[k]?.value !== '').length;
  if (given === 1) add('dates_pair', header.open?.line ?? header.due?.line ?? start);
  if (releaseOn && dueOn && dueOn < releaseOn) add('dates_order', header.due?.line ?? start, { open: releaseOn, due: dueOn });

  // ── questions
  const questions: ParsedQuestion[] = [];
  const numbers = new Set<number>();
  let cur: Draft | null = null;
  const finish = () => {
    if (!cur) return;
    const q = cur;
    cur = null;
    const at = q.line;
    const prompt = q.prompt.join(' ').replace(/\s+/g, ' ').trim();
    if (prompt === '') add('prompt_empty', at, { n: q.number });
    else if (prompt.length > IMPORT_LIMITS.maxPrompt) add('prompt_too_long', at, { n: q.number, max: IMPORT_LIMITS.maxPrompt });
    const letters = q.choices.map((c) => c.letter.toUpperCase()).join('');
    if (q.choices.length !== 4) add('choice_count', at, { n: q.number, found: q.choices.length });
    else if (letters !== 'ABCD') add('choice_count', at, { n: q.number, found: q.choices.length });
    const choices = q.choices.map((c) => c.text.replace(/\s+/g, ' ').trim());
    choices.forEach((c, k) => {
      if (c === '') add('choice_empty', at, { n: q.number, letter: 'ABCD'[k] ?? '?' });
      else if (c.length > IMPORT_LIMITS.maxChoice) add('choice_too_long', at, { n: q.number, letter: 'ABCD'[k] ?? '?', max: IMPORT_LIMITS.maxChoice });
    });
    if (new Set(choices.map((c) => fold(c).replace(/\s+/g, ' '))).size !== choices.length) add('duplicate_choice', at, { n: q.number });
    let correct = -1;
    if (q.answer === null) add('missing_answer', at, { n: q.number });
    else {
      correct = 'abcd'.indexOf(q.answer.toLowerCase());
      if (correct < 0) add('invalid_answer', q.answerLine, { n: q.number, value: q.answer });
    }
    let explanation: string | null = null;
    let source = q.source;
    if (q.explanation) {
      const split = splitSource(q.explanation.join(' ').replace(/\s+/g, ' '));
      explanation = split.explanation === '' ? null : split.explanation;
      source = split.source ?? source;
    }
    if (explanation && explanation.length > IMPORT_LIMITS.maxExplanation) add('explanation_too_long', at, { n: q.number, max: IMPORT_LIMITS.maxExplanation });
    if (source && source.length > IMPORT_LIMITS.maxSource) add('source_too_long', at, { n: q.number, max: IMPORT_LIMITS.maxSource });
    if (numbers.has(q.number)) add('duplicate_number', at, { n: q.number });
    numbers.add(q.number);
    questions.push({ number: q.number, prompt, choices, correct, explanation, source, line: at + 1 });
  };

  for (; i < end; i++) {
    const raw = lines[i] as string;
    if (raw.trim() === '') continue;
    const qs = QUESTION_START.exec(raw);
    if (qs) {
      finish();
      cur = { number: Number(qs[1]), line: i, prompt: [qs[2] as string], choices: [], answer: null, answerLine: i, explanation: null, source: null, stage: 'prompt' };
      continue;
    }
    if (!cur) {
      add('unexpected_line', i, { text: raw.trim().slice(0, 60) });
      continue;
    }
    const draft: Draft = cur;
    const kv = keyValue(raw);
    if (kv && ANSWER_KEYS.has(kv[0]) && draft.stage !== 'explanation') {
      const m = /^([A-Za-z])(?![\p{L}\p{N}])/u.exec(kv[1]);
      draft.answer = m ? (m[1] as string).toUpperCase() : kv[1] === '' ? null : kv[1].slice(0, 12);
      draft.answerLine = i;
      draft.stage = 'answer';
      continue;
    }
    if (kv && EXPLANATION_KEYS.has(kv[0])) {
      draft.explanation = [kv[1]];
      draft.stage = 'explanation';
      continue;
    }
    if (kv && SOURCE_KEYS.has(kv[0]) && (draft.stage === 'answer' || draft.stage === 'explanation')) {
      draft.source = kv[1] === '' ? null : kv[1];
      draft.stage = 'explanation';
      continue;
    }
    const ch = draft.stage === 'prompt' || draft.stage === 'choices' ? CHOICE.exec(raw) ?? (draft.stage === 'choices' ? EXTRA_CHOICE.exec(raw) : null) : null;
    if (ch) {
      draft.choices.push({ letter: ch[1] as string, text: ch[2] as string });
      draft.stage = 'choices';
      continue;
    }
    if (draft.stage === 'prompt') draft.prompt.push(raw);
    else if (draft.stage === 'choices') {
      const last = draft.choices[draft.choices.length - 1];
      if (last) last.text += ` ${raw.trim()}`;
    } else if (draft.stage === 'explanation' && draft.explanation) draft.explanation.push(raw.trim());
    else add('unexpected_line', i, { text: raw.trim().slice(0, 60) });
  }
  finish();

  if (questions.length === 0) add('no_questions', start);
  if (questions.length > IMPORT_LIMITS.maxQuestions) add('too_many_questions', start, { found: questions.length, max: IMPORT_LIMITS.maxQuestions });

  if (errors.length > before || !country || !grade || !subject) return null;
  return { block, line: start + 1, country, grade, subject, week, title, releaseOn, dueOn, questions };
}

/** Questions au format attendu par `create_catalog_draft` (`correct` = indice 0 à 3 ; source recopiée ; jamais « à vérifier » : la réponse est LUE dans le fichier). */
export const draftQuestions = (q: ParsedQuiz) =>
  q.questions.map((x) => ({ prompt: x.prompt, choices: x.choices, correct: x.correct, explanation: x.explanation, source: x.source }));
