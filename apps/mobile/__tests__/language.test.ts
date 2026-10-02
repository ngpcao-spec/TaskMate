import i18n from '@/i18n';
import { isLanguage, loadLanguage, setLanguage } from '@/i18n/language';

const mockStore = new Map<string, string>();
jest.mock('@/sync/storage', () => ({
  kvStorage: {
    getItem: (k: string) => mockStore.get(k) ?? null,
    setItem: (k: string, v: string) => void mockStore.set(k, v),
    removeItem: (k: string) => void mockStore.delete(k),
  },
}));

describe('langue', () => {
  beforeEach(async () => { mockStore.clear(); await i18n.changeLanguage('vi'); });

  it('vietnamien par défaut (SPEC §3.9)', () => expect(loadLanguage()).toBe('vi'));
  it('ignore une valeur stockée inconnue', () => {
    mockStore.set('taskmate-language', 'klingon');
    expect(loadLanguage()).toBe('vi');
  });
  it('persiste et applique le choix', async () => {
    await setLanguage('fr');
    expect(loadLanguage()).toBe('fr');
    expect(i18n.t('tabs.today')).toBe("Aujourd'hui");
    await setLanguage('en');
    expect(i18n.t('tabs.today')).toBe('Today');
  });
  it('isLanguage', () => {
    expect(isLanguage('vi')).toBe(true);
    expect(isLanguage('de')).toBe(false);
    expect(isLanguage(3)).toBe(false);
  });
});
