import en from './locales/en.json';
import fr from './locales/fr.json';
import vi from './locales/vi.json';

function keys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

describe('locales', () => {
  it.each([
    ['fr', fr],
    ['en', en],
  ])('%s a exactement les mêmes clés que vi', (_name, locale) => {
    expect(keys(locale).sort()).toEqual(keys(vi).sort());
  });
});
