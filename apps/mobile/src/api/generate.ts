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
  count: number;
  language: 'auto' | 'vi' | 'fr' | 'en';
  files: { name: string; mediaType: string; data: string }[];
};
export type GenerateResult = { set_id: string; title: string; count: number; truncated: boolean };

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
