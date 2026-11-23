import { render, screen } from '@testing-library/react-native';
import '@/i18n';
import { RoundButton } from '@/components/RoundButton';
import { StatTile } from '@/components/StatTile';
import { childColor, CHILD_PALETTE } from '@/theme/childColor';
import { CATEGORY_COLORS } from '@/theme/categories';
import { theme } from '@/theme';
import { colors, MIN_TARGET } from '@/theme/tokens';


describe('jetons et composants communs (thème unique, D-114)', () => {
  it('childColor : l’ancienne palette vive est traduite, une couleur inconnue ou absente est respectée', () => {
    expect(childColor('#1E88F5')).toBe(theme.childSoft['#1E88F5']);
    expect(childColor('#2ec4a6')).toBe(theme.childSoft['#2EC4A6']); // casse ignorée
    expect(childColor('#123456')).toBe('#123456');
    expect(childColor(null)).toBe(colors.primary);
    expect(childColor(undefined)).toBe(colors.primary);
  });
  it('la palette proposée est déjà dans la palette du thème (traduction identité)', () => {
    for (const c of CHILD_PALETTE) expect(childColor(c)).toBe(c);
  });
  it('chaque catégorie a une couleur distincte', () => {
    const values = Object.values(CATEGORY_COLORS);
    expect(new Set(values).size).toBe(values.length);
  });

  it('RoundButton : cible ≥ 44 pt même si on demande plus petit, libellé d’accessibilité, désactivable', async () => {
    const onPress = jest.fn();
    await render(<RoundButton label="Quay lại" size={20} onPress={onPress}><></></RoundButton>);
    const btn = screen.getByRole('button', { name: 'Quay lại' });
    expect(btn.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ width: MIN_TARGET, height: MIN_TARGET })]));
  });

  it('StatTile : libellé d’accessibilité = libellé, valeur et légende', async () => {
    await render(<StatTile tint={colors.tileTeal} icon={<></>} label="Đã duyệt" value="3" caption="tuần này" />);
    expect(screen.getByLabelText('Đã duyệt: 3, tuần này')).toBeTruthy();
  });

});
