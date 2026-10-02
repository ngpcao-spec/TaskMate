/** Alphabet sans caractères ambigus (0/O, 1/I) — SPEC §5.8. */
export const INVITE_CODE_REGEX = /^[A-HJ-NP-Z2-9]{6}$/;

export function normalizeInviteCode(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase();
}

export function isValidInviteCode(raw: string): boolean {
  return INVITE_CODE_REGEX.test(normalizeInviteCode(raw));
}

/** Extrait le code d'un lien `taskmate://join?code=ABC234` ou d'un QR contenant le code seul. */
export function parseInviteLink(data: string): string | null {
  const trimmed = data.trim();
  const match = /^taskmate:\/\/join\?(?:.*&)?code=([^&#]+)/i.exec(trimmed);
  const candidate = normalizeInviteCode(match?.[1] ? decodeURIComponent(match[1]) : trimmed);
  return INVITE_CODE_REGEX.test(candidate) ? candidate : null;
}

export function buildInviteLink(code: string): string {
  return `taskmate://join?code=${normalizeInviteCode(code)}`;
}
