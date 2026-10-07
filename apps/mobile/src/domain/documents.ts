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
  minQuestions: 5,
  maxQuestions: 20,
  defaultQuestions: 10,
} as const;

export type DocKind = 'image' | 'pdf' | 'docx';

export const clampCount = (n: number): number => Math.min(DOC_LIMITS.maxQuestions, Math.max(DOC_LIMITS.minQuestions, Math.round(n)));

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

/** Contrôle l'ensemble (déjà choisi + ajouts) : images seules, OU un seul PDF, OU un seul Word ; tailles bornées. null = valide. */
export function validateSelection(files: readonly { kind: DocKind; bytes: number }[]): SelectionError | null {
  if (files.length > DOC_LIMITS.maxFiles) return 'tooMany';
  const documents = files.filter((f) => f.kind !== 'image');
  if (documents.length > 1 || (documents.length === 1 && files.length > 1)) return 'unsupportedMix';
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
  network: 'revisions.import.errors.network',
};

/** Clé i18n du message pour un code d'erreur de `generate-questions` (repli : message générique). */
export const generateErrorKey = (code: string): string => SERVER_ERRORS[code] ?? 'revisions.import.errors.generic';

export const selectionErrorKey = (e: SelectionError): string =>
  ({ tooMany: 'revisions.import.errors.tooMany', unsupportedMix: 'revisions.import.errors.unsupportedMix', tooLarge: 'revisions.import.errors.tooLarge', totalTooLarge: 'revisions.import.errors.totalTooLarge' })[e];
