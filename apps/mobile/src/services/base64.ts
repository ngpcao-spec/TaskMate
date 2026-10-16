/** base64 (sans préfixe) → octets. Dans un fichier à part : `documentText.ts` et `documentText.web.ts` se résolvent au MÊME nom de module selon la plateforme, ils ne doivent pas s'importer l'un l'autre. */
export const base64ToBytes = (b64: string): Uint8Array => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** Texte d'un document choisi, lu sur l'appareil (jamais envoyé ni conservé). */
export type FileText = { ok: true; text: string } | { ok: false; reason: 'unsupported' | 'unreadable' | 'too_large' | 'no_text' };
