import type { TFunction } from 'i18next';
import { subjectLabelKey } from '@/domain/catalog';

/** Libellé d'une matière du catalogue (clé stable → vi/fr/en) ; une clé hors liste s'affiche telle quelle. */
export const subjectText = (t: TFunction, key: string): string => {
  const k = subjectLabelKey(key);
  return k ? t(k) : key;
};
