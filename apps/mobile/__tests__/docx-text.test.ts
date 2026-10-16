import { readFileSync } from 'fs';
import { join } from 'path';
import { strToU8, zipSync } from 'fflate';
import { decodeXml, docxXmlToText, extractDocxText } from '@/domain/docx-text';
import { extractFileText } from '@/services/documentText';
import { parseCatalogImport } from '@/domain/catalog-import';

const fixture = (name: string) => new Uint8Array(readFileSync(join(__dirname, 'fixtures', name)));
const expectedText = readFileSync(join(__dirname, 'fixtures', 'qcm-structured.txt'), 'utf-8').trim();
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const para = (text: string, numPr = '') => `<w:p>${numPr ? `<w:pPr><w:numPr>${numPr}</w:numPr></w:pPr>` : ''}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
const zipDocx = (documentXml: string, numberingXml?: string) =>
  zipSync({ 'word/document.xml': strToU8(`<w:document ${W}><w:body>${documentXml}</w:body></w:document>`), ...(numberingXml ? { 'word/numbering.xml': strToU8(`<w:numbering ${W}>${numberingXml}</w:numbering>`) } : {}) });

describe('texte d\'un fichier Word', () => {
  it('fichier Word réel (python-docx) : une ligne par paragraphe, accents et Đ intacts', () => {
    const r = extractDocxText(fixture('qcm-structured.docx'));
    expect(r).toEqual({ ok: true, text: expectedText });
  });
  it('le texte lu est un fichier structuré valide : 2 QCM (VN et FR), 5 questions', () => {
    const r = parseCatalogImport(expectedText);
    expect(r.structured && r.ok).toBe(true);
    if (!(r.structured && r.ok)) return;
    expect(r.quizzes.map((q) => [q.country, q.grade, q.subject, q.week, q.questions.length])).toEqual([['VN', '5', 'hist_geo', 'Tuần 7', 3], ['FR', '5E', 'maths', 'Semaine 3', 2]]);
    expect(r.quizzes[0]?.questions[0]).toMatchObject({ correct: 0, source: 'Bài 5, mục 1' });
    expect(r.quizzes[1]?.questions[0]).toMatchObject({ correct: 1, explanation: 'Deux moitiés font un entier.', source: 'Chapitre 2' });
  });
  it('service : base64 → texte (Word)', async () => {
    const data = Buffer.from(fixture('qcm-structured.docx')).toString('base64');
    const r = await extractFileText({ name: 'a.docx', kind: 'docx', mediaType: 'x', data, bytes: 1 });
    expect(r).toEqual({ ok: true, text: expectedText });
    expect(await extractFileText({ name: 'a.pdf', kind: 'pdf', mediaType: 'x', data, bytes: 1 })).toEqual({ ok: false, reason: 'unsupported' }); // natif : PDF lu par la version web
    expect(await extractFileText({ name: 'a.docx', kind: 'docx', mediaType: 'x', data: 'AAAA', bytes: 1 })).toEqual({ ok: false, reason: 'unreadable' });
    expect(await extractFileText({ name: 'a.docx', kind: 'docx', mediaType: 'x', data: '***', bytes: 1 })).toEqual({ ok: false, reason: 'unreadable' });
  });
  it('entités XML, tabulations, retours à la ligne, texte supprimé et codes de champ ignorés', () => {
    const xml = '<w:p><w:r><w:t>a &amp; b &lt;c&gt; &#233; &#x1F600;</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>d</w:t></w:r><w:r><w:br/></w:r><w:r><w:t>e</w:t></w:r><w:del><w:r><w:delText>supprimé</w:delText></w:r></w:del><w:r><w:instrText> PAGE </w:instrText></w:r></w:p><w:p/>';
    expect(docxXmlToText(xml, null)).toBe('a & b <c> é 😀\td\ne\n');
    expect(decodeXml('&unknown; &#0; &#xFFFFFFF;')).toBe('&unknown;  ');
  });
  it('numérotation automatique de Word reconstituée : « 1. », « A. », sous-niveaux et redémarrage', () => {
    const numbering = `
      <w:abstractNum w:abstractNumId="0">
        <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl>
        <w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="upperLetter"/><w:lvlText w:val="%2."/></w:lvl>
        <w:lvl w:ilvl="2"><w:start w:val="1"/><w:numFmt w:val="lowerRoman"/><w:lvlText w:val="(%3)"/></w:lvl>
      </w:abstractNum>
      <w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl></w:abstractNum>
      <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
      <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>`;
    const n = (id: number, lvl: number) => `<w:ilvl w:val="${lvl}"/><w:numId w:val="${id}"/>`;
    const xml = [
      para('Question un ?', n(1, 0)), para('premier', n(1, 1)), para('deuxième', n(1, 1)), para('romain', n(1, 2)),
      para('Question deux ?', n(1, 0)), para('premier', n(1, 1)),
      para('puce', n(2, 0)), para('sans numéro'), para('liste inconnue', n(9, 0)), para('numéro zéro', n(0, 0)),
    ].join('');
    const r = extractDocxText(zipDocx(xml, numbering));
    expect(r).toEqual({ ok: true, text: ['1. Question un ?', 'A. premier', 'B. deuxième', '(i) romain', '2. Question deux ?', 'A. premier', 'puce', 'sans numéro', 'liste inconnue', 'numéro zéro'].join('\n') });
  });
  it('lettres au-delà de Z : AA, AB', () => {
    const numbering = '<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="27"/><w:numFmt w:val="upperLetter"/><w:lvlText w:val="%1)"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>';
    const r = extractDocxText(zipDocx(para('x', '<w:ilvl w:val="0"/><w:numId w:val="1"/>') + para('y', '<w:ilvl w:val="0"/><w:numId w:val="1"/>'), numbering));
    expect(r).toEqual({ ok: true, text: 'AA) x\nAB) y' });
  });
  it('ce n\'est pas un .docx', () => {
    expect(extractDocxText(new Uint8Array([1, 2, 3]))).toEqual({ ok: false, reason: 'not_docx' });
    expect(extractDocxText(zipSync({ 'hello.txt': strToU8('x') }))).toEqual({ ok: false, reason: 'not_docx' });
  });
  it('partie décompressée trop grosse (zip bomb) : refusée', () => {
    const big = zipSync({ 'word/document.xml': new Uint8Array(21 * 1024 * 1024) });
    expect(big.length).toBeLessThan(100_000);
    expect(extractDocxText(big)).toEqual({ ok: false, reason: 'too_large' });
  });
});
