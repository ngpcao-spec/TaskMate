import type { DocKind } from '@/domain/documents';

export type PickedFile = { name: string; kind: DocKind; mediaType: string; /** base64 sans préfixe */ data: string; bytes: number };
export type PickSource = 'camera' | 'gallery' | 'document';
export type PickResult = { status: 'ok'; files: PickedFile[] } | { status: 'cancelled' } | { status: 'unsupported' } | { status: 'error'; code: 'unreadable' | 'unsupportedType' | 'tooLarge' };

/** Le chargement de documents n'est disponible que dans l'application web (PWA) : cible principale (D-025, D-057). */
export const documentUploadSupported = false;

export async function pickDocuments(_source: PickSource): Promise<PickResult> {
  return { status: 'unsupported' };
}
