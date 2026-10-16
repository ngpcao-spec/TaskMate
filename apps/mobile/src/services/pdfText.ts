import { pdfItemsToLines, type PdfItem } from '@/domain/pdf-text';

/**
 * Lecture du TEXTE d'un PDF (pdf.js, côté client, sans rien envoyer ni conserver). Le chargement de la bibliothèque est INJECTÉ : sur le web elle est importée à la demande
 * (elle n'alourdit pas le démarrage), dans les tests elle est chargée directement. Le travail se fait dans le fil principal (`pdfjsWorker` fourni en ligne) :
 * aucun fichier annexe à servir, suffisant pour des PDF de texte.
 */
export type PdfText = { ok: true; text: string } | { ok: false; reason: 'not_pdf' | 'no_text' };
export type PdfLoader = () => Promise<{ worker: unknown; lib: PdfLib }>;
type TextItem = { str: string; transform: number[]; hasEOL?: boolean };
type PdfLib = {
  getDocument: (src: Record<string, unknown>) => {
    promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: unknown[] }> }>; destroy: () => Promise<void> }>;
  };
};

const MAX_PAGES = 200;

export async function extractPdfTextWith(load: PdfLoader, bytes: Uint8Array): Promise<PdfText> {
  try {
    const { worker, lib } = await load();
    const g = globalThis as { pdfjsWorker?: unknown };
    if (!g.pdfjsWorker) g.pdfjsWorker = worker;
    const doc = await lib.getDocument({ data: bytes.slice(), isEvalSupported: false, useSystemFonts: false, disableFontFace: true, verbosity: 0 }).promise;
    const lines: string[] = [];
    const pages = Math.min(doc.numPages, MAX_PAGES);
    for (let n = 1; n <= pages; n++) {
      const content = await (await doc.getPage(n)).getTextContent();
      const items: PdfItem[] = [];
      for (const it of content.items as Partial<TextItem>[]) {
        if (typeof it.str === 'string' && it.transform) items.push({ str: it.str, y: it.transform[5] as number, hasEOL: it.hasEOL });
      }
      lines.push(...pdfItemsToLines(items));
    }
    await doc.destroy();
    const text = lines.join('\n');
    return text.trim() === '' ? { ok: false, reason: 'no_text' } : { ok: true, text };
  } catch {
    return { ok: false, reason: 'not_pdf' };
  }
}
