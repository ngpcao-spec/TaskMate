/** Code d'invitation d'un parent (D-050) : 8 caractères, alphabet sans ambiguïté (miroir de `create_parent_invite`, migration 12). */
export const PARENT_INVITE_LENGTH = 8;
export const PARENT_INVITE_REGEX = /^[A-HJ-NP-Z2-9]{8}$/;

/** Saisie → forme canonique : majuscules, sans espace ni tiret (« abcd-efgh » → « ABCDEFGH »). */
export const normalizeInviteCode = (raw: string): string => raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
export const isValidInviteCode = (raw: string): boolean => PARENT_INVITE_REGEX.test(normalizeInviteCode(raw));
/** Affichage par groupes de 4 : « ABCD-EFGH ». */
export const formatInviteCode = (code: string): string => (code.length === PARENT_INVITE_LENGTH ? `${code.slice(0, 4)}-${code.slice(4)}` : code);

/** Erreurs de la RPC `join_family_with_code` / `create_family` traduites en code stable pour l'écran. */
export type JoinFailure = 'invalidCode' | 'tooManyAttempts' | 'googleRequired' | 'alreadyMember' | 'lastParent' | 'unknown';
export function toJoinFailure(message: string | undefined): JoinFailure {
  switch (message) {
    case 'too_many_attempts':
      return 'tooManyAttempts';
    case 'google_required':
      return 'googleRequired';
    case 'already_member':
      return 'alreadyMember';
    default:
      return 'unknown';
  }
}
