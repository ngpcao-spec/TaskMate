import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Screen } from '@/components/ui';
import { BottomBarContext, safeEdgesFor, useHasBottomBar } from '@/components/TabInset';

const mockSafeAreaProps = jest.fn();
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: (props: { children: React.ReactNode }) => {
    mockSafeAreaProps(props);
    return props.children;
  },
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

function Probe() {
  return <Text>{`bar:${useHasBottomBar()}`}</Text>;
}

describe('marge de sécurité du bas des écrans (barre de navigation du bas)', () => {
  it('hors onglets ou grand écran : pas de barre du bas, l’écran garde son bord bas', async () => {
    await render(<Probe />);
    expect(screen.getByText('bar:false')).toBeTruthy();
    expect(safeEdgesFor(false)).toContain('bottom');
  });

  it('au-dessus de la barre du bas : l’écran n’ajoute pas la marge du bas (déjà dans la barre), sinon une bande vide apparaît', async () => {
    await render(
      <BottomBarContext.Provider value={true}>
        <Probe />
      </BottomBarContext.Provider>,
    );
    expect(screen.getByText('bar:true')).toBeTruthy();
    expect(safeEdgesFor(true)).toEqual(['top', 'right', 'left']);
    expect(safeEdgesFor(true)).not.toContain('bottom');
  });

  it('Screen : sans le bord bas dans les onglets, avec tous les bords ailleurs', async () => {
    mockSafeAreaProps.mockClear();
    await render(
      <BottomBarContext.Provider value={true}>
        <Screen>
          <Text>x</Text>
        </Screen>
      </BottomBarContext.Provider>,
    );
    expect(mockSafeAreaProps).toHaveBeenLastCalledWith(expect.objectContaining({ edges: ['top', 'right', 'left'] }));
    mockSafeAreaProps.mockClear();
    await render(
      <Screen>
        <Text>y</Text>
      </Screen>,
    );
    expect(mockSafeAreaProps).toHaveBeenLastCalledWith(expect.objectContaining({ edges: ['top', 'right', 'bottom', 'left'] }));
  });
});
