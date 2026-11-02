import { render, screen } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { StatusBarScrim } from '@/components/StatusBarScrim';
import { SceneHeader } from '@/v2/components/SceneHeader';
import { Bell } from 'lucide-react-native';
import '@/i18n';

const H = { includeHiddenElements: true } as const;
const insets = (top: number) => ({ top, bottom: 34, left: 0, right: 0 });
const withInsets = (top: number, el: React.ReactElement) => <SafeAreaInsetsContext.Provider value={insets(top)}>{el}</SafeAreaInsetsContext.Provider>;

describe('barre d’état translucide (D-106)', () => {
  beforeEach(() => jest.replaceProperty(Platform, 'OS', 'web'));
  afterEach(() => jest.restoreAllMocks());

  it('voile : hauteur = marge haute + 16, sans capter les touches, décoratif', async () => {
    await render(withInsets(47, <StatusBarScrim color="#000000" />));
    const scrim = screen.getByTestId('status-bar-scrim', H);
    expect(StyleSheet.flatten(scrim.props.style)).toMatchObject({ position: 'absolute', top: 0, height: 63 });
    expect(scrim.props.pointerEvents).toBe('none');
    expect(scrim.props['aria-hidden']).toBe(true);
  });
  it('voile : rien sans marge haute (navigateur, Android) ni hors web', async () => {
    await render(withInsets(0, <StatusBarScrim color="#000000" />));
    expect(screen.queryByTestId('status-bar-scrim', H)).toBeNull();
    jest.replaceProperty(Platform, 'OS', 'ios');
    await render(withInsets(59, <StatusBarScrim color="#000000" />));
    expect(screen.queryByTestId('status-bar-scrim', H)).toBeNull();
  });
  it('SceneHeader : le décor part de y = 0 SOUS la barre d’état (hauteur + marge), les boutons sous la barre', async () => {
    await render(withInsets(59, <SceneHeader testID="hdr" scene="home" height={300} right={[{ key: 'bell', Icon: Bell, label: 'Thông báo', onPress: jest.fn() }]} />));
    expect(StyleSheet.flatten(screen.getByTestId('hdr').props.style)).toMatchObject({ height: 359 });
    expect(StyleSheet.flatten(screen.getByTestId('v2-scene-home', H).props.style)).toMatchObject({ position: 'absolute', top: 0 });
    const bar = screen.getByTestId('v2-top-bell').parent?.parent;
    expect(StyleSheet.flatten(bar?.props.style)).toMatchObject({ paddingTop: 59 + 8 });
  });
});
