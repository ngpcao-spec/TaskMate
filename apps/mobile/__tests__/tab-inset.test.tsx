import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { bottomPaddingFor, TabInsetContext, useTabInset } from '@/components/TabInset';

function Probe() {
  return <Text>{`inset:${useTabInset()}`}</Text>;
}

describe('marge basse des écrans à défilement (barre de navigation du bas)', () => {
  it('hors onglets (aucune barre mesurée) : marge normale', async () => {
    await render(<Probe />);
    expect(screen.getByText('inset:0')).toBeTruthy();
    expect(bottomPaddingFor(0)).toBe(16);
  });

  it('dans les onglets : la hauteur mesurée de la barre s’ajoute, le dernier élément reste atteignable', async () => {
    await render(
      <TabInsetContext.Provider value={104}>
        <Probe />
      </TabInsetContext.Provider>,
    );
    expect(screen.getByText('inset:104')).toBeTruthy();
    expect(bottomPaddingFor(104)).toBe(120);
    expect(bottomPaddingFor(104, 8)).toBe(112);
  });

  it('colonne latérale (grand écran) ou valeur invalide : aucune marge ajoutée', () => {
    expect(bottomPaddingFor(0)).toBe(16);
    expect(bottomPaddingFor(-5)).toBe(16);
  });
});
