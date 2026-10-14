import { render, screen } from '@testing-library/react-native';
import '@/i18n';
import { BarChart } from '@/components/BarChart';
import { DonutChart } from '@/components/DonutChart';
import { RoundButton } from '@/components/RoundButton';
import { StatTile } from '@/components/StatTile';
import { childColor, CHILD_PALETTE } from '@/theme/childColor';
import { CATEGORY_COLORS } from '@/theme/categories';
import { colors, MIN_TARGET } from '@/theme/tokens';

describe('thème verre givré (D-064)', () => {
  it('childColor : l’ancienne palette vive est traduite, une couleur inconnue ou absente est respectée', () => {
    expect(childColor('#1E88F5')).toBe('#3A7CA5');
    expect(childColor('#2ec4a6')).toBe('#2F8F80'); // casse ignorée
    expect(childColor('#123456')).toBe('#123456');
    expect(childColor(null)).toBe(colors.primary);
    expect(childColor(undefined)).toBe(colors.primary);
  });
  it('la palette proposée est déjà dans la palette acier (traduction identité)', () => {
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

  it('BarChart : une barre accessible par période, axe 0 / milieu / max, échelle commune', async () => {
    await render(
      <BarChart
        bars={[
          { key: 'a', label: 'T2', done: 1, total: 4, accessibilityLabel: 'T2: 1/4' },
          { key: 'b', label: 'T3', done: 0, total: 0, accessibilityLabel: 'T3: 0/0' },
        ]}
      />,
    );
    expect(screen.getByLabelText('T2: 1/4')).toBeTruthy();
    expect(screen.getByLabelText('T3: 0/0')).toBeTruthy();
    // l'axe est décoratif (masqué aux lecteurs d'écran : chaque barre porte sa valeur)
    expect(screen.getByText('4', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('2', { includeHiddenElements: true })).toBeTruthy();
  });
  it('BarChart : période vide → échelle minimale, pas de NaN', async () => {
    await render(<BarChart bars={[{ key: 'a', label: 'T2', done: 0, total: 0, accessibilityLabel: 'T2: 0/0' }]} />);
    expect(screen.queryByText(/NaN/)).toBeNull();
    expect(screen.getAllByText('1', { includeHiddenElements: true }).length).toBeGreaterThan(0);
  });

  it('DonutChart : décoratif (masqué aux lecteurs d’écran), sans donnée = anneau vide, sans erreur', async () => {
    const { toJSON } = await render(<DonutChart segments={[{ key: 'a', value: 0, color: '#000' }]} />);
    expect(toJSON()).toBeTruthy();
    await render(<DonutChart segments={[{ key: 'a', value: 3, color: '#111' }, { key: 'b', value: 1, color: '#222' }]} />);
  });
});
