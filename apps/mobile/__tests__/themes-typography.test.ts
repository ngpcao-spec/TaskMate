import { colors, typography } from '@/theme/tokens';

describe('styles de texte (thème sombre « cosmos » compris)', () => {
  it('le titre, le texte courant et le texte secondaire ont une couleur de THÈME (jamais le noir par défaut)', () => {
    expect(typography.title.color).toBe(colors.text);
    expect(typography.body.color).toBe(colors.text);
    expect(typography.secondary.color).toBe(colors.textSecondary);
  });
});
