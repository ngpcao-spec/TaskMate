import i18n, { SUPPORTED_LANGUAGES, type Language } from './index';
import { kvStorage } from '@/sync/storage';

const KEY = 'taskmate-language';

export const isLanguage = (v: unknown): v is Language => typeof v === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(v);

/** Langue enregistrée sur l'appareil (vietnamien par défaut, SPEC §3.9). */
export function loadLanguage(): Language {
  const stored = kvStorage.getItem(KEY);
  return isLanguage(stored) ? stored : 'vi';
}

export async function setLanguage(lang: Language): Promise<void> {
  kvStorage.setItem(KEY, lang);
  await i18n.changeLanguage(lang);
}

export function applyStoredLanguage(): void {
  const lang = loadLanguage();
  if (i18n.language !== lang) void i18n.changeLanguage(lang);
}
