import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fr from './locales/fr.json';
import vi from './locales/vi.json';

export const SUPPORTED_LANGUAGES = ['vi', 'fr', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources: { vi: { translation: vi }, fr: { translation: fr }, en: { translation: en } },
  lng: 'vi',
  fallbackLng: 'vi',
  interpolation: { escapeValue: false },
});

export default i18n;
