import { extractDocxText } from '@/domain/docx-text';
import { base64ToBytes, type FileText } from './base64';
import type { PickedFile } from './documents';

export type { FileText } from './base64';

/** Natif : Word seulement ; le PDF est lu par la version web (`documentText.web.ts`). */
export async function extractFileText(file: PickedFile): Promise<FileText> {
  if (file.kind !== 'docx') return { ok: false, reason: 'unsupported' };
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(file.data);
  } catch {
    return { ok: false, reason: 'unreadable' };
  }
  const r = extractDocxText(bytes);
  if (!r.ok) return { ok: false, reason: r.reason === 'too_large' ? 'too_large' : 'unreadable' };
  return r.text.trim() === '' ? { ok: false, reason: 'no_text' } : { ok: true, text: r.text };
}
