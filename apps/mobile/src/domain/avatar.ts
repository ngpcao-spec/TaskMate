/**
 * Avatar « dessin animé » de l'enfant (D-071) : règles pures. Le serveur reste l'autorité (consentement du parent, quota, validation du dessin) ;
 * ces fonctions servent à l'affichage, au traitement du portrait avant envoi et au choix des messages.
 */

/** Portrait envoyé à l'IA : redimensionné et recompressé côté appareil (le serveur plafonne à 3 Mo). */
export const AVATAR_LIMITS = { maxSide: 1024, maxBytes: 2_500_000, jpegQuality: 0.85 } as const;

export type AvatarRow = { child_id: string; ai_allowed: boolean; image_b64: string | null; version: number };

/** Avatar d'un enfant, prêt à afficher (`uri` null = pas d'avatar : initiale colorée). */
export type AvatarInfo = { allowed: boolean; uri: string | null; version: number };
export const NO_AVATAR: AvatarInfo = { allowed: false, uri: null, version: 0 };

export const avatarUri = (b64: string): string => `data:image/webp;base64,${b64}`;

/** Lignes du serveur → informations par enfant. Les lignes sans identifiant ou avec une image qui n'est pas du WebP sont ignorées. */
export function avatarMap(rows: readonly AvatarRow[]): Record<string, AvatarInfo> {
  const out: Record<string, AvatarInfo> = {};
  for (const row of rows) {
    if (!row.child_id) continue;
    out[row.child_id] = { allowed: row.ai_allowed, uri: row.image_b64 && row.image_b64.startsWith('UklGR') ? avatarUri(row.image_b64) : null, version: row.version };
  }
  return out;
}

/** Qui peut lancer une création : l'enfant (pour lui-même) ou un parent, à condition que le parent ait consenti pour cet enfant. */
export const canGenerateAvatar = (allowed: boolean): boolean => allowed;

const ERRORS: Record<string, string> = {
  quota_exceeded: 'avatar.errors.quota',
  ai_not_configured: 'avatar.errors.notConfigured',
  ai_timeout: 'avatar.errors.timeout',
  ai_refused: 'avatar.errors.refused',
  ai_error: 'avatar.errors.generic',
  invalid_output: 'avatar.errors.generic',
  save_failed: 'avatar.errors.generic',
  server_error: 'avatar.errors.generic',
  avatar_not_allowed: 'avatar.errors.notAllowed',
  forbidden: 'avatar.errors.notAllowed',
  child_not_found: 'avatar.errors.generic',
  no_candidate: 'avatar.errors.generic',
  file_too_large: 'avatar.errors.tooLarge',
  unsupported_type: 'avatar.errors.unsupportedType',
  invalid_input: 'avatar.errors.unsupportedType',
  network: 'avatar.errors.network',
  unreadable: 'avatar.errors.unreadable',
  unsupportedType: 'avatar.errors.unsupportedType',
  tooLarge: 'avatar.errors.tooLarge',
};

/** Code d'erreur (de la fonction, de la base ou du choix de la photo) → clé i18n ; inconnu = message générique. */
export const avatarErrorKey = (code: string): string => ERRORS[code] ?? 'avatar.errors.generic';
