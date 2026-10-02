/** Fuseau IANA valide ? (via Intl — pas de liste codée en dur). */
export function isValidTimeZone(tz: string): boolean {
  if (!tz || tz.trim() !== tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Fuseaux proposés en raccourci (la saisie libre reste possible). */
export const COMMON_TIMEZONES = ['Asia/Ho_Chi_Minh', 'Asia/Bangkok', 'Asia/Singapore', 'Europe/Paris', 'America/New_York', 'UTC'] as const;
