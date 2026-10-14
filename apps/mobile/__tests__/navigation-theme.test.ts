import { colors } from '@/theme/tokens';
import { navigationTheme } from '@/theme/navigation';

describe('thème de navigation', () => {
  it('reprend les couleurs du thème actif (plus de fond gris par défaut derrière la barre du bas)', () => {
    expect(navigationTheme.colors.background).toBe(colors.background);
    expect(navigationTheme.colors.card).toBe(colors.cardSolid);
    expect(navigationTheme.colors.text).toBe(colors.text);
  });
});
