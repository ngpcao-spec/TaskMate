import { DOC_LIMITS, fitWithin, kindOfFile, type DocKind } from '@/domain/documents';
import type { PickedFile, PickResult, PickSource } from './documents';

export type { PickedFile, PickResult, PickSource } from './documents';
export const documentUploadSupported = true;

const ACCEPT: Record<PickSource, string> = { camera: 'image/*', gallery: 'image/*', document: 'application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document' };

/** Ouvre le sélecteur du navigateur (doit être appelée depuis un geste de l'utilisateur) : appareil photo, galerie ou fichier. */
function chooseFiles(source: PickSource): Promise<File[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPT[source];
    input.multiple = source !== 'camera';
    if (source === 'camera') input.setAttribute('capture', 'environment');
    input.style.display = 'none';
    const finish = (files: File[] | null) => {
      input.remove();
      resolve(files);
    };
    input.addEventListener('change', () => finish(input.files && input.files.length > 0 ? Array.from(input.files) : null));
    input.addEventListener('cancel', () => finish(null));
    document.body.appendChild(input);
    input.click();
  });
}

function readBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { source: bitmap, width: bitmap.width, height: bitmap.height };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise<void>((ok, ko) => {
        img.onload = () => ok();
        img.onerror = () => ko(new Error('decode'));
        img.src = url;
      });
      return { source: img, width: img.naturalWidth, height: img.naturalHeight };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

const toBlob = (canvas: HTMLCanvasElement, quality: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));

/** Photo → JPEG redimensionné (≤ 1600 px, qualité 0,8) : le document envoyé à l'IA reste léger et lisible (HEIC compris). */
async function compressImage(file: File): Promise<PickedFile> {
  const decoded = await decode(file);
  let scale = 1;
  let quality: number = DOC_LIMITS.jpegQuality;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { width, height } = fitWithin(Math.round(decoded.width * scale), Math.round(decoded.height * scale), DOC_LIMITS.maxImageSide);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.fillStyle = '#fff'; // PNG transparents : fond blanc plutôt que noir
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(decoded.source, 0, 0, width, height);
    const blob = await toBlob(canvas, quality);
    if (!blob) throw new Error('encode');
    if (blob.size <= DOC_LIMITS.maxImageBytes) {
      const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
      return { name, kind: 'image', mediaType: 'image/jpeg', data: await readBase64(blob), bytes: blob.size };
    }
    quality = Math.max(0.5, quality - 0.15);
    scale *= 0.8;
  }
  throw new Error('too_large');
}

async function prepare(file: File): Promise<PickedFile> {
  const kind: DocKind | null = kindOfFile(file);
  if (kind === null) throw new Error('type');
  if (kind === 'image') return compressImage(file);
  const cap = kind === 'pdf' ? DOC_LIMITS.maxPdfBytes : DOC_LIMITS.maxDocxBytes;
  if (file.size > cap) throw new Error('too_large');
  return { name: file.name, kind, mediaType: file.type || (kind === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), data: await readBase64(file), bytes: file.size };
}

export async function pickDocuments(source: PickSource): Promise<PickResult> {
  const chosen = await chooseFiles(source);
  if (!chosen) return { status: 'cancelled' };
  try {
    return { status: 'ok', files: await Promise.all(chosen.map(prepare)) };
  } catch (e) {
    const message = e instanceof Error ? e.message : '';
    return { status: 'error', code: message === 'type' ? 'unsupportedType' : message === 'too_large' ? 'tooLarge' : 'unreadable' };
  }
}
