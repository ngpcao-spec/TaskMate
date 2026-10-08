/**
 * Chargement d'un document de révision (D-057) : limites et règles pures, miroir des contrôles de l'Edge Function `generate-questions`
 * (qui reste l'autorité : le serveur revérifie tout, y compris le type réel d'après les premiers octets).
 */
export const DOC_LIMITS = {
  maxFiles: 5,
  maxImageBytes: 3_000_000,
  maxPdfBytes: 4_500_000,
  maxDocxBytes: 4_000_000,
  maxTotalBytes: 6_000_000,
  /** Plus grand côté d'une photo après redimensionnement côté client (la lisibilité d'une page tient largement dans 1600 px). */
  maxImageSide: 1600,
  jpegQuality: 0.8,
  /** Nombre précis demandable (le plafond réel est celui du SERVEUR, 30 par défaut : il revérifie et signale toute coupe). */
  minQuestions: 3,
  maxQuestions: 30,
  /** Valeur de départ du sélecteur « nombre précis » (la valeur par défaut du nombre est « Auto »). */
  defaultQuestions: 10,
  maxInstruction: 300,
} as const;

/** Type de support demandé : « Auto » (par défaut, l'IA détecte) ou un type précis. Liste extensible (une valeur ici, une consigne côté fonction). */
export const MATERIAL_KINDS = ['exam', 'exam_key', 'course', 'list'] as const;
export type MaterialKind = (typeof MATERIAL_KINDS)[number];
export const REQUEST_KINDS = ['auto', ...MATERIAL_KINDS] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];
export type FileRole = 'exam' | 'key';

/** Types « examen » : recopie fidèle, grille « Đáp án », réponses à confirmer avant publication (règle aussi appliquée par la base). */
export const isExamKind = (k: MaterialKind): boolean => k === 'exam' || k === 'exam_key';
/** Un corrigé n'est proposé qu'avec « examen avec corrigé » (obligatoire) ou Auto (facultatif, il fait détecter « examen avec corrigé »). */
export const allowsKey = (k: RequestKind): boolean => k === 'auto' || k === 'exam_key';

export type DocKind = 'image' | 'pdf' | 'docx';

export const clampCount = (n: number): number => Math.min(DOC_LIMITS.maxQuestions, Math.max(DOC_LIMITS.minQuestions, Math.round(n)));

/** Consigne libre du parent : facultative ; la saisie est bornée (le serveur revérifie). */
export const instructionTooLong = (text: string): boolean => text.trim().length > DOC_LIMITS.maxInstruction;

/** Type de fichier d'après son type MIME ou, à défaut, son extension ; null si non pris en charge. */
export function kindOfFile(file: { name: string; type: string }): DocKind | null {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (type === 'image/jpeg' || type === 'image/png' || type === 'image/webp' || type === 'image/heic' || type === 'image/heif') return 'image';
  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx')) return 'docx';
  if (/\.(jpe?g|png|webp|heic|heif)$/.test(name)) return 'image';
  return null;
}

export type SelectionError = 'tooMany' | 'unsupportedMix' | 'tooLarge' | 'totalTooLarge';

/**
 * Contrôle l'ensemble (déjà choisi + ajouts) : au plus 5 fichiers au total (le corrigé compte dans les mêmes limites), tailles bornées ; dans CHAQUE rôle
 * (examen, corrigé) : images seules, OU un seul PDF, OU un seul Word. null = valide.
 */
export function validateSelection(files: readonly { kind: DocKind; bytes: number; role?: FileRole }[]): SelectionError | null {
  if (files.length > DOC_LIMITS.maxFiles) return 'tooMany';
  for (const role of ['exam', 'key'] as const) {
    const group = files.filter((f) => (f.role ?? 'exam') === role);
    const documents = group.filter((f) => f.kind !== 'image');
    if (documents.length > 1 || (documents.length === 1 && group.length > 1)) return 'unsupportedMix';
  }
  let total = 0;
  for (const f of files) {
    const cap = f.kind === 'pdf' ? DOC_LIMITS.maxPdfBytes : f.kind === 'docx' ? DOC_LIMITS.maxDocxBytes : DOC_LIMITS.maxImageBytes;
    if (f.bytes > cap) return 'tooLarge';
    total += f.bytes;
  }
  return total > DOC_LIMITS.maxTotalBytes ? 'totalTooLarge' : null;
}

/** Dimensions après réduction (jamais d'agrandissement), proportions conservées. */
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide || longest <= 0) return { width, height };
  const scale = maxSide / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Octets décodés d'une chaîne base64 (sans la décoder). */
export const base64Bytes = (b64: string): number => Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);

const SERVER_ERRORS: Record<string, string> = {
  ai_not_configured: 'revisions.import.errors.notConfigured',
  quota_exceeded: 'revisions.import.errors.quota',
  file_too_large: 'revisions.import.errors.tooLarge',
  total_too_large: 'revisions.import.errors.totalTooLarge',
  too_many_files: 'revisions.import.errors.tooMany',
  too_many_pages: 'revisions.import.errors.tooManyPages',
  unsupported_type: 'revisions.import.errors.unsupportedType',
  unsupported_mix: 'revisions.import.errors.unsupportedMix',
  unreadable_file: 'revisions.import.errors.unreadable',
  invalid_file: 'revisions.import.errors.unreadable',
  empty_file: 'revisions.import.errors.unreadable',
  no_text: 'revisions.import.errors.noText',
  no_file: 'revisions.import.errors.noFile',
  no_usable_content: 'revisions.import.errors.noContent',
  invalid_output: 'revisions.import.errors.aiFailed',
  ai_error: 'revisions.import.errors.aiFailed',
  ai_refused: 'revisions.import.errors.aiFailed',
  ai_timeout: 'revisions.import.errors.timeout',
  forbidden: 'revisions.import.errors.forbidden',
  not_authenticated: 'revisions.import.errors.forbidden',
  child_not_found: 'revisions.import.errors.forbidden',
  invalid_count: 'revisions.import.errors.invalidCount',
  invalid_kind: 'revisions.import.errors.generic',
  key_required: 'revisions.import.errors.keyRequired',
  key_not_allowed: 'revisions.import.errors.keyNotAllowed',
  instruction_too_long: 'revisions.import.errors.instructionTooLong',
  save_failed: 'revisions.import.errors.saveFailed',
  network: 'revisions.import.errors.network',
};

/** Clé i18n du message pour un code d'erreur de `generate-questions` (repli : message générique). */
export const generateErrorKey = (code: string): string => SERVER_ERRORS[code] ?? 'revisions.import.errors.generic';

export const selectionErrorKey = (e: SelectionError): string =>
  ({ tooMany: 'revisions.import.errors.tooMany', unsupportedMix: 'revisions.import.errors.unsupportedMix', tooLarge: 'revisions.import.errors.tooLarge', totalTooLarge: 'revisions.import.errors.totalTooLarge' })[e];

/** Résultat renvoyé par la fonction (voir `GenerateResult` côté API) : ce que le parent doit savoir avant de relire. */
export type GenerateSummaryInput = {
  kind: MaterialKind;
  kind_detected: boolean;
  kind_doubt: boolean;
  count: number;
  found: number;
  capped: boolean;
  ignored: string[];
  ignored_count: number;
  to_verify_count: number;
  figure_count: number;
  truncated: boolean;
};
export type SummaryNotice = { key: string; values: Record<string, string | number> };

/**
 * Avertissements affichés au parent après une génération — JAMAIS de coupe ou d'omission silencieuse :
 * plafond atteint (« 42 QCM trouvées, 30 reprises »), questions non QCM ignorées (avec leurs numéros), figures, réponses à vérifier, type incertain, texte tronqué.
 */
export function summaryNotices(r: GenerateSummaryInput): SummaryNotice[] {
  const notices: SummaryNotice[] = [];
  if (r.kind_doubt) notices.push({ key: 'revisions.import.result.doubt', values: {} });
  if (r.capped) notices.push({ key: 'revisions.import.result.capped', values: { found: r.found, kept: r.count } });
  if (r.ignored_count > 0) notices.push({ key: 'revisions.import.result.ignored', values: { count: r.ignored_count, labels: r.ignored.join(', ') } });
  if (r.figure_count > 0) notices.push({ key: 'revisions.import.result.figures', values: { count: r.figure_count } });
  if (r.to_verify_count > 0) notices.push({ key: 'revisions.import.result.toVerify', values: { count: r.to_verify_count } });
  if (r.truncated) notices.push({ key: 'revisions.import.truncated', values: {} });
  return notices;
}

/** Écran de relecture d'un jeu généré : la grille « Đáp án » pour les examens, l'éditeur sinon. */
export const reviewRoute = (kind: MaterialKind): '/quiz/answers' | '/quiz/[id]' => (isExamKind(kind) ? '/quiz/answers' : '/quiz/[id]');
