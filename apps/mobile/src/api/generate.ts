import type { FileRole, MaterialKind, RequestKind } from '@/domain/documents';
import { supabase } from './supabase';

/** Erreur renvoyée par l'Edge Function `generate-questions` : `code` court (ex. `quota_exceeded`) + éventuels détails (limite, usage). */
export class GenerateError extends Error {
  constructor(readonly code: string, readonly details: Record<string, unknown> = {}) {
    super(code);
  }
}

export type GenerateInput = {
  setId: string;
  childId: string;
  title?: string;
  subject?: string;
  /** Type de support : « auto » (par défaut, l'IA détecte) ou un type précis. */
  kind: RequestKind;
  /** « auto » (par défaut) ou un nombre précis. */
  count: 'auto' | number;
  /** Consigne libre du parent (facultative, 300 caractères au plus), transmise dans un bloc séparé du document. */
  instruction?: string;
  /** Relance après correction du type : remplace le MÊME brouillon (une relance par jeu ne consomme pas de quota). */
  retry?: boolean;
  language: 'auto' | 'vi' | 'fr' | 'en';
  files: { name: string; mediaType: string; data: string; role: FileRole }[];
};
export type GenerateResult = {
  set_id: string;
  title: string;
  /** Questions enregistrées. */
  count: number;
  truncated: boolean;
  kind: MaterialKind;
  kind_detected: boolean;
  kind_doubt: boolean;
  /** QCM trouvées dans le document (examens) ; `capped` si certaines n'ont pas été reprises. */
  found: number;
  capped: boolean;
  cap: number;
  ignored: string[];
  ignored_count: number;
  to_verify_count: number;
  figure_count: number;
  free_retry: boolean;
};

async function parseFailure(error: unknown): Promise<GenerateError> {
  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.json === 'function') {
    try {
      const body = (await context.json()) as Record<string, unknown>;
      const { error: code, ...details } = body;
      return new GenerateError(typeof code === 'string' ? code : 'generic', details);
    } catch {
      return new GenerateError('generic');
    }
  }
  return new GenerateError('network');
}

/** Envoie le document à l'Edge Function (en ligne uniquement) ; le jeu généré est enregistré en BROUILLON côté serveur. */
export async function generateQuestions(input: GenerateInput): Promise<GenerateResult> {
  const { data, error } = await supabase.functions.invoke<GenerateResult>('generate-questions', { method: 'POST', body: input });
  if (error || !data) throw await parseFailure(error);
  return data;
}
