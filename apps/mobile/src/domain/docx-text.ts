import { strFromU8, unzipSync } from 'fflate';

/**
 * Texte d'un fichier Word (.docx) sans le conserver : le .docx est un zip dont `word/document.xml` contient les paragraphes. Un paragraphe = une ligne.
 * La numérotation automatique de Word (« 1. », « A. » générés par une liste) n'est pas dans le texte : elle est reconstituée depuis `word/numbering.xml`
 * (décimal, lettres, chiffres romains) pour que « 1. Question / A. choix » soit lisible comme dans le document. Fonction pure, testée.
 */
const MAX_PART_BYTES = 20 * 1024 * 1024;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
export const decodeXml = (s: string): string =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1]?.toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

type Level = { fmt: string; text: string; start: number };
type Numbering = { nums: Map<string, string>; abstracts: Map<string, Map<number, Level>> };

function parseNumbering(xml: string): Numbering {
  const abstracts = new Map<string, Map<number, Level>>();
  for (const a of xml.matchAll(/<w:abstractNum\b[^>]*w:abstractNumId="(\d+)"[^>]*>([\s\S]*?)<\/w:abstractNum>/g)) {
    const levels = new Map<number, Level>();
    for (const l of (a[2] as string).matchAll(/<w:lvl\b[^>]*w:ilvl="(\d+)"[^>]*>([\s\S]*?)<\/w:lvl>/g)) {
      const body = l[2] as string;
      levels.set(Number(l[1]), {
        fmt: /<w:numFmt\b[^>]*w:val="([^"]*)"/.exec(body)?.[1] ?? 'decimal',
        text: decodeXml(/<w:lvlText\b[^>]*w:val="([^"]*)"/.exec(body)?.[1] ?? ''),
        start: Number(/<w:start\b[^>]*w:val="(\d+)"/.exec(body)?.[1] ?? 1),
      });
    }
    abstracts.set(a[1] as string, levels);
  }
  const nums = new Map<string, string>();
  for (const n of xml.matchAll(/<w:num\b[^>]*w:numId="(\d+)"[^>]*>([\s\S]*?)<\/w:num>/g)) {
    const abstractId = /<w:abstractNumId\b[^>]*w:val="(\d+)"/.exec(n[2] as string)?.[1];
    if (abstractId) nums.set(n[1] as string, abstractId);
  }
  return { nums, abstracts };
}

const ROMAN: [number, string][] = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
function formatCounter(fmt: string, n: number): string {
  switch (fmt) {
    case 'upperLetter':
    case 'lowerLetter': {
      let s = '';
      for (let k = n; k > 0; k = Math.floor((k - 1) / 26)) s = String.fromCharCode(97 + ((k - 1) % 26)) + s;
      return fmt === 'upperLetter' ? s.toUpperCase() : s;
    }
    case 'upperRoman':
    case 'lowerRoman': {
      let s = '';
      let k = n;
      for (const [v, r] of ROMAN) while (k >= v) { s += r; k -= v; }
      return fmt === 'upperRoman' ? s.toUpperCase() : s;
    }
    case 'bullet':
    case 'none':
      return '';
    default:
      return String(n);
  }
}

export function docxXmlToText(documentXml: string, numberingXml: string | null): string {
  const numbering = numberingXml ? parseNumbering(numberingXml) : null;
  const counters = new Map<string, number[]>();
  const lines: string[] = [];
  for (const p of documentXml.matchAll(/<w:p\b[^>]*?(?:\/>|>([\s\S]*?)<\/w:p>)/g)) {
    const body = p[1] ?? '';
    const text = decodeXml(
      body
        .replace(/<w:(?:br|cr)\b[^>]*\/>/g, '\n')
        .replace(/<w:tab\b[^>]*\/>/g, '\t')
        .replace(/<w:(?:delText|instrText)\b[\s\S]*?<\/w:(?:delText|instrText)>/g, '') // texte supprimé (suivi des modifications) et codes de champs
        .replace(/<[^>]+>/g, ''),
    );
    let prefix = '';
    const numPr = /<w:numPr>([\s\S]*?)<\/w:numPr>/.exec(body)?.[1];
    if (numPr && numbering) {
      const numId = /<w:numId\b[^>]*w:val="(\d+)"/.exec(numPr)?.[1];
      const ilvl = Number(/<w:ilvl\b[^>]*w:val="(\d+)"/.exec(numPr)?.[1] ?? 0);
      const levels = numId && numId !== '0' ? numbering.abstracts.get(numbering.nums.get(numId) ?? '') : undefined;
      const level = levels?.get(ilvl);
      if (numId && levels && level) {
        const c = counters.get(numId) ?? [];
        c[ilvl] = (c[ilvl] ?? level.start - 1) + 1;
        c.length = ilvl + 1; // un niveau plus profond repart de son début
        counters.set(numId, c);
        prefix = level.fmt === 'bullet' || level.fmt === 'none' ? '' : level.text.replace(/%(\d)/g, (_m, d: string) => {
          const idx = Number(d) - 1;
          const lv = levels.get(idx);
          return lv ? formatCounter(lv.fmt, c[idx] ?? lv.start) : '';
        });
        if (prefix !== '') prefix += ' ';
      }
    }
    for (const part of (prefix + text).split('\n')) lines.push(part);
  }
  return lines.join('\n');
}

export type DocxResult = { ok: true; text: string } | { ok: false; reason: 'not_docx' | 'too_large' };

/** Texte d'un .docx (octets) ; `not_docx` si ce n'est pas un zip Word lisible, `too_large` si une partie dépasse 20 Mo décompressée. */
export function extractDocxText(bytes: Uint8Array): DocxResult {
  let parts: Record<string, Uint8Array>;
  try {
    let tooLarge = false;
    parts = unzipSync(bytes, {
      filter: (f) => {
        if (f.name !== 'word/document.xml' && f.name !== 'word/numbering.xml') return false;
        if (f.originalSize > MAX_PART_BYTES) tooLarge = true;
        return !tooLarge;
      },
    });
    if (tooLarge) return { ok: false, reason: 'too_large' };
  } catch {
    return { ok: false, reason: 'not_docx' };
  }
  const doc = parts['word/document.xml'];
  if (!doc) return { ok: false, reason: 'not_docx' };
  return { ok: true, text: docxXmlToText(strFromU8(doc), parts['word/numbering.xml'] ? strFromU8(parts['word/numbering.xml']) : null) };
}
