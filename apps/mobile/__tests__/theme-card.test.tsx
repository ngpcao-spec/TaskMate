import { fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import { ThemeCard } from '@/components/ThemeCard';
import { kvStorage } from '@/sync/storage';
import { THEME_KEY } from '@/theme/themeStore';

describe('ThemeCard (D-069)', () => {
  beforeEach(() => kvStorage.removeItem(THEME_KEY));

  it('propose les quatre apparences, « Kính mờ » est celle en cours par défaut', async () => {
    await render(<ThemeCard />);
    expect(screen.getByRole('radio', { name: 'Kính mờ' }).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByRole('radio', { name: 'Kawaii' }).props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.getByRole('radio', { name: 'Vũ trụ' }).props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.getByRole('radio', { name: 'Gấu nâu' }).props.accessibilityState).toMatchObject({ selected: false });
  });

  it('choisir Kawaii l’enregistre sur l’appareil et explique comment l’appliquer (natif : rouvrir l’app)', async () => {
    await render(<ThemeCard />);
    expect(screen.queryByText(/mở lại/)).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: 'Kawaii' }));
    expect(kvStorage.getItem(THEME_KEY)).toBe('kawaii');
    expect(await screen.findByText(/mở lại/)).toBeTruthy();
  });

  it('choisir Vũ trụ (cosmos) l’enregistre aussi sur l’appareil', async () => {
    await render(<ThemeCard />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Vũ trụ' }));
    expect(kvStorage.getItem(THEME_KEY)).toBe('cosmos');
    expect(await screen.findByText(/mở lại/)).toBeTruthy();
  });

  it('choisir Gấu nâu (teddy) l’enregistre aussi sur l’appareil', async () => {
    await render(<ThemeCard />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Gấu nâu' }));
    expect(kvStorage.getItem(THEME_KEY)).toBe('teddy');
    expect(await screen.findByText(/mở lại/)).toBeTruthy();
  });

  it('re-choisir le thème en cours ne change rien', async () => {
    await render(<ThemeCard />);
    await fireEvent.press(screen.getByRole('radio', { name: 'Kính mờ' }));
    expect(kvStorage.getItem(THEME_KEY)).toBeNull();
    expect(screen.queryByText(/mở lại/)).toBeNull();
  });
});
