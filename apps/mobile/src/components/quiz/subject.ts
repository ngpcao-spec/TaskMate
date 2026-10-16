import type { TFunction } from 'i18next';
import { subjectLabelKey } from '@/domain/catalog';

/** Libellé d'une matière du catalogue (clé stable → vi/fr/en) ; une clé hors liste s'affiche telle quelle. */
export const subjectText = (t: TFunction, key: string): string => {
  const k = subjectLabelKey(key);
  return k ? t(k) : key;
};

/** Libellé d'une classe : « Lớp 5 » (VN, numéro) ; « 5e », « CM2 », « Terminale »… (FR, libellés traduits). */
export const gradeText = (t: TFunction, country: string, grade: string): string => (country === 'FR' ? t(`catalog.frGrades.${grade}`, { defaultValue: grade }) : t('catalog.gradeValue', { grade }));
