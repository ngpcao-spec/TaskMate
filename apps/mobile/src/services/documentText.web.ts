import { extractDocxText } from '@/domain/docx-text';
import type { PickedFile } from './documents';
import { base64ToBytes, type FileText } from './base64';
import { extractPdfTextWith, type PdfLoader } from './pdfText';

export type { FileText } from './base64';

// pdf.js n'est téléchargé qu'au premier PDF lu. Selon l'empaquetage, les exports du build « legacy » (UMD) sont sur le module ou sur `default` : on prend là où ils sont.
const exportsOf = <T extends object>(mod: unknown, key: string): T => {
  const m = mod as { default?: unknown } & Record<string, unknown>;
  return (m[key] ? m : (m.default ?? m)) as T;
};
const loadPdfJs: PdfLoader = async () => ({
  worker: exportsOf(await import('pdfjs-dist/legacy/build/pdf.worker.js'), 'WorkerMessageHandler'),
  lib: exportsOf<Awaited<ReturnType<PdfLoader>>['lib']>(await import('pdfjs-dist/legacy/build/pdf.js'), 'getDocument'),
});

/** Word et PDF avec texte, lus dans le navigateur : le fichier n'est ni envoyé ni conservé. */
export async function extractFileText(file: PickedFile): Promise<FileText> {
  if (file.kind !== 'docx' && file.kind !== 'pdf') return { ok: false, reason: 'unsupported' };
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(file.data);
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
  if (file.kind === 'pdf') {
    const r = await extractPdfTextWith(loadPdfJs, bytes);
    return r.ok ? r : { ok: false, reason: r.reason === 'no_text' ? 'no_text' : 'unreadable' };
  }
  const r = extractDocxText(bytes);
  if (!r.ok) return { ok: false, reason: r.reason === 'too_large' ? 'too_large' : 'unreadable' };
  return r.text.trim() === '' ? { ok: false, reason: 'no_text' } : { ok: true, text: r.text };
}
