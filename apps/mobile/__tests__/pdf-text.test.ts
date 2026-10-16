import { readFileSync } from 'fs';
import { join } from 'path';
import { pdfItemsToLines } from '@/domain/pdf-text';
import { extractPdfTextWith, type PdfLoader } from '@/services/pdfText';

// dans Jest on charge pdf.js directement (l'import dynamique n'y est pas disponible) ; le web l'importe à la demande
const load: PdfLoader = async () => ({ worker: jest.requireActual('pdfjs-dist/legacy/build/pdf.worker.js'), lib: jest.requireActual('pdfjs-dist/legacy/build/pdf.js') });
const extractPdfText = (b: Uint8Array) => extractPdfTextWith(load, b);

const fixture = (name: string) => new Uint8Array(readFileSync(join(__dirname, 'fixtures', name)));

describe('texte d\'un PDF', () => {
  it('lignes recomposées depuis les fragments', () => {
    expect(pdfItemsToLines([{ str: 'Pays', y: 100 }, { str: ': VN', y: 100 }, { str: 'Classe: 5', y: 80 }, { str: 'a', y: 60, hasEOL: true }, { str: 'b', y: 60 }, { str: '   ', y: 40 }])).toEqual(['Pays: VN', 'Classe: 5', 'a', 'b']);
    expect(pdfItemsToLines([])).toEqual([]);
    expect(pdfItemsToLines([{ str: 'x', y: 10 }, { str: 'y', y: 11.5 }])).toEqual(['xy']); // même ligne (tolérance)
  });
  it('PDF réel (accents et Đ vietnamiens compris)', async () => {
    const r = await extractPdfText(fixture('qcm-structured.pdf'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const expected = readFileSync(join(__dirname, 'fixtures', 'qcm-structured.txt'), 'utf-8').trim().split('\n');
    expect(r.text.split('\n')).toEqual(expected);
  }, 30000);
  it('chargeur en échec : « pas un PDF », jamais une exception', async () => {
    expect(await extractPdfTextWith(async () => { throw new Error('x'); }, new Uint8Array([1]))).toEqual({ ok: false, reason: 'not_pdf' });
  });
  it('ce n\'est pas un PDF', async () => {
    expect(await extractPdfText(new Uint8Array([1, 2, 3, 4]))).toEqual({ ok: false, reason: 'not_pdf' });
  });
});
