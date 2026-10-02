export type BirthDateError = 'format' | 'invalid' | 'future' | 'tooOld';

/** Valide une date `YYYY-MM-DD` de naissance d'enfant (0–25 ans) à la date `today`. */
export function validateBirthDate(value: string, today: string): BirthDateError | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return 'format';
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return 'invalid';
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  if (iso > today) return 'future';
  const [ty, tm, td] = today.split('-').map(Number) as [number, number, number];
  const age = ty - y - (tm < mo || (tm === mo && td < d) ? 1 : 0);
  return age > 25 ? 'tooOld' : null;
}
