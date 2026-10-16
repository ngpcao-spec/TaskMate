/** Un fragment de texte d'une page PDF (position dans la page en points ; `y` croît vers le HAUT, comme dans pdf.js). */
export type PdfItem = { str: string; y: number; hasEOL?: boolean };

/** Recompose des lignes de texte depuis les fragments d'une page, dans l'ordre du contenu : nouvelle ligne quand la hauteur change ou à la fin de ligne signalée. */
export function pdfItemsToLines(items: readonly PdfItem[], tolerance = 3): string[] {
  const lines: string[] = [];
  let current = '';
  let lastY: number | null = null;
  const flush = () => {
    const t = current.replace(/[ \t]+/g, ' ').trim();
    if (t !== '') lines.push(t);
    current = '';
  };
  for (const it of items) {
    if (lastY !== null && Math.abs(it.y - lastY) > tolerance) flush();
    current += it.str;
    lastY = it.y;
    if (it.hasEOL) {
      flush();
      lastY = null;
    }
  }
  flush();
  return lines;
}
