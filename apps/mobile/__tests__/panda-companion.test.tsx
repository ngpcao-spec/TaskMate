import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Animated } from 'react-native';
import { createTestQueryClient } from '../test-utils/queryClient';
import '@/i18n';
import { ParentPandaCard } from '@/components/companion/ParentPandaCard';
import { PandaCompanion } from '@/components/companion/PandaCompanion';
import { PandaSettingsCard } from '@/components/companion/PandaSettingsCard';
import { PandaSetupCard } from '@/components/companion/PandaSetupCard';
import { parseCompanionState, type CompanionState } from '@/domain/panda';
import { REACTION_MS, usePandaReaction } from '@/store/pandaReaction';

const mockFetch = jest.fn();
const mockSetup = jest.fn();
const mockOffset = jest.fn();
jest.mock('@/api/companion', () => ({
  fetchCompanionState: (...a: unknown[]) => mockFetch(...a),
  setupCompanion: (...a: unknown[]) => mockSetup(...a),
  setCompanionStageOffset: (...a: unknown[]) => mockOffset(...a),
}));
jest.mock('@/api/supabase', () => ({ supabase: {} }));

const state = (over: Partial<CompanionState> = {}): CompanionState => ({
  hasCompanion: true,
  name: 'Bambou',
  trait: 'kind',
  variant: 'boy',
  stage: 2,
  stageOffset: 0,
  energyTotal: 20,
  level: 1,
  nextLevelAt: 50,
  ...over,
});

const clients: ReturnType<typeof createTestQueryClient>[] = [];
const withClient = (ui: React.ReactElement) => {
  const client = createTestQueryClient();
  clients.push(client);
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
};

beforeEach(() => {
  mockFetch.mockReset();
  mockSetup.mockReset().mockResolvedValue(undefined);
  mockOffset.mockReset().mockResolvedValue(undefined);
  usePandaReaction.setState({ childId: null, id: 0, active: false });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  clients.splice(0).forEach((c) => c.clear());
});

const companion = (over: Partial<React.ComponentProps<typeof PandaCompanion>> = {}) => (
  <PandaCompanion childId="c1" childName="Minh" state={state()} done={0} total={3} localHour={10} {...over} />
);

describe('PandaCompanion', () => {
  it('affiche nom, niveau, énergie et une image avec un libellé lisible', async () => {
    await render(companion());
    expect(screen.getByRole('header', { name: 'Bambou' })).toBeTruthy();
    expect(screen.getByText('Thân thiết cấp 1')).toBeTruthy();
    expect(screen.getByLabelText('Năng lượng 20 trên 100')).toBeTruthy();
    expect(screen.getByLabelText('Panda Bambou, bình tĩnh')).toBeTruthy();
    expect(screen.getByText('20/100')).toBeTruthy();
  });

  it('l’humeur suit les tâches du jour (très heureux, fier, endormi après 20 h)', async () => {
    const view = await render(companion({ done: 2, total: 3 }));
    expect(screen.getByLabelText('Panda Bambou, rất vui')).toBeTruthy();
    await view.rerender(companion({ done: 3, total: 3 }));
    expect(screen.getByLabelText('Panda Bambou, tự hào')).toBeTruthy();
    await view.rerender(companion({ done: 0, total: 3, localHour: 21 }));
    expect(screen.getByLabelText('Panda Bambou, đang ngủ')).toBeTruthy();
  });

  it('la bulle parle à l’enfant par son prénom (stade 1) sans jamais nommer un autre enfant', async () => {
    await render(companion({ state: state({ stage: 1 }), done: 0, total: 3, localHour: 8 }));
    expect(screen.getByText('Chào buổi sáng, Minh!')).toBeTruthy();
  });

  it('coche : réaction immédiate (très heureux, « +5 ⚡ ») pendant 2 s, puis retour à l’humeur du jour', async () => {
    jest.useFakeTimers();
    await render(companion({ done: 1, total: 3 }));
    expect(screen.getByLabelText('Panda Bambou, vui')).toBeTruthy();
    expect(screen.queryByText('+5 ⚡')).toBeNull();
    await act(async () => usePandaReaction.getState().trigger('c1', 5));
    expect(screen.getByLabelText('Panda Bambou, rất vui')).toBeTruthy();
    expect(screen.getByText('+5 ⚡')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(REACTION_MS - 50);
    });
    expect(screen.getByText('+5 ⚡')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(screen.queryByText('+5 ⚡')).toBeNull();
    expect(screen.getByLabelText('Panda Bambou, vui')).toBeTruthy();
  });

  it('la réaction d’un autre enfant ne touche pas ce panda', async () => {
    jest.useFakeTimers();
    await render(companion({ done: 1, total: 3 }));
    await act(async () => usePandaReaction.getState().trigger('autre-enfant', 5));
    expect(screen.queryByText('+5 ⚡')).toBeNull();
    expect(screen.getByLabelText('Panda Bambou, vui')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(REACTION_MS + 10);
    });
  });

  it('rebond à chaque réaction, sauf avec « réduire les animations »', async () => {
    jest.useFakeTimers();
    const sequence = jest.spyOn(Animated, 'sequence');
    await render(companion());
    await act(async () => usePandaReaction.getState().trigger('c1', 5));
    expect(sequence).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(REACTION_MS + 10);
    });
    sequence.mockClear();
    await act(async () => usePandaReaction.getState().trigger('c1', 5));
    expect(sequence).toHaveBeenCalledTimes(1);
  });

  it('« réduire les animations » : aucun rebond, la réaction reste visible', async () => {
    jest.useFakeTimers();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const sequence = jest.spyOn(Animated, 'sequence');
    await render(companion());
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => usePandaReaction.getState().trigger('c1', 5));
    expect(sequence).not.toHaveBeenCalled();
    expect(screen.getByText('+5 ⚡')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(REACTION_MS + 10);
    });
  });

  it('sans nom : « Bambou » par défaut ; niveau supérieur affiché', async () => {
    await render(companion({ state: state({ name: null, energyTotal: 320, level: 3, nextLevelAt: 600 }) }));
    expect(screen.getByRole('header', { name: 'Bambou' })).toBeTruthy();
    expect(screen.getByText('Thân thiết cấp 3')).toBeTruthy();
    expect(screen.getByLabelText('Năng lượng 320 trên 600')).toBeTruthy();
  });
});

describe('promenade (D-106)', () => {
  const layout = async (width = 316) =>
    act(async () => {
      fireEvent(screen.getByTestId('panda-lane'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width, height: 116 } } });
    });
  const transformOf = (): Record<string, unknown> => {
    const flat = Object.assign({}, ...[screen.getByTestId('panda-walker').props.style].flat(Infinity).filter(Boolean)) as { transform?: Record<string, unknown>[] };
    return Object.assign({}, ...(flat.transform ?? []));
  };

  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });

  it('marche d’un bord à l’autre, se retourne, puis revient', async () => {
    const loop = jest.spyOn(Animated, 'loop');
    const timing = jest.spyOn(Animated, 'timing');
    await render(companion());
    await layout(316); // course 200 pt : départ au centre (100)
    expect(loop).toHaveBeenCalledTimes(2); // la marche et les petits pas
    expect(transformOf()).toMatchObject({ translateX: 100, scaleX: 1 });
    const moves = timing.mock.calls.map(([, config]) => config as { toValue: number; duration: number });
    // vers la droite (bord à 200) en regardant à droite, puis vers la gauche (0) retourné, puis à nouveau vers la droite
    expect(moves.map((m) => m.toValue)).toEqual(expect.arrayContaining([200, 0, -1, 1]));
    expect(moves.find((m) => m.toValue === 0 && m.duration > 0)?.duration).toBe(Math.round((200 / 30) * 1000)); // traversée calme
    expect(moves.find((m) => m.toValue === 200)?.duration).toBe(Math.round((100 / 30) * 1000)); // premier trajet : du centre au bord
  });

  it('immobile au centre quand il dort (après 20 h, rien de fait)', async () => {
    const loop = jest.spyOn(Animated, 'loop');
    await render(companion({ done: 0, total: 3, localHour: 21 }));
    await layout(316);
    expect(loop).not.toHaveBeenCalled();
    expect(transformOf()).toMatchObject({ translateX: 100, scaleX: 1 });
  });

  it('« réduire les animations » : aucune promenade', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const loop = jest.spyOn(Animated, 'loop');
    await render(companion());
    await act(async () => {
      await Promise.resolve();
    });
    await layout(316);
    expect(loop).not.toHaveBeenCalled();
  });

  it('panneau trop étroit : reste au centre', async () => {
    const loop = jest.spyOn(Animated, 'loop');
    await render(companion());
    await layout(130);
    expect(loop).not.toHaveBeenCalled();
  });

  it('en voyage : la carte postale, pas de promenade', async () => {
    const loop = jest.spyOn(Animated, 'loop');
    const away = { gauge: 0, cost: 30, state: 'away' as const, level: 1, today: '2026-11-01', active: { id: 'a', destination: 'ha-long', departedOn: '2026-11-01', returnsOn: '2026-11-02' }, last: null, unlocked: ['ha-long'], destinations: [], found: [], foundCount: 0, totalCount: 30 };
    await render(withClient(companion({ adventure: away })));
    await layout(316);
    expect(loop).not.toHaveBeenCalled();
    expect(screen.queryByTestId('panda-walker')).toBeNull();
  });
});

describe('première fois : « Panda của em »', () => {
  const none = state({ hasCompanion: false, name: null, trait: null });

  it('propose « Bambou », six traits, et enregistre le choix', async () => {
    await render(withClient(<PandaSetupCard childId="c1" state={none} />));
    expect(screen.getByRole('header', { name: 'Panda của em' })).toBeTruthy();
    expect(screen.getByDisplayValue('Bambou')).toBeTruthy();
    for (const label of ['Tò mò', 'Kiên trì', 'Tốt bụng', 'Dũng cảm', 'Vui tính', 'Bình tĩnh']) expect(screen.getByRole('radio', { name: label })).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Tên của Panda'), 'Mochi');
    await fireEvent.press(screen.getByRole('radio', { name: 'Dũng cảm' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Gặp Panda!' }));
    await waitFor(() => expect(mockSetup).toHaveBeenCalledWith('c1', 'Mochi', 'brave'));
  });

  it('passer l’étape : le panda s’appelle « Panda »', async () => {
    await render(withClient(<PandaSetupCard childId="c1" state={none} />));
    await fireEvent.press(screen.getByRole('button', { name: 'Bỏ qua, gọi là Panda' }));
    await waitFor(() => expect(mockSetup).toHaveBeenCalledWith('c1', 'Panda', 'kind'));
  });

  it('nom vide ou trop long : refusé avant tout appel', async () => {
    await render(withClient(<PandaSetupCard childId="c1" state={none} />));
    await fireEvent.changeText(screen.getByLabelText('Tên của Panda'), '   ');
    expect(screen.getByText('Tên dài từ 1 đến 20 ký tự')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Gặp Panda!' }));
    expect(mockSetup).not.toHaveBeenCalled();
  });
});

describe('réglages de l’enfant', () => {
  it('nom et trait : enregistrement seulement après un changement', async () => {
    mockFetch.mockResolvedValue(parseCompanionState({ has_companion: true, name: 'Bambou', trait: 'kind', stage: 2, stage_offset: 0, energy_total: 20, level: 1, next_level_at: 50 }));
    await render(withClient(<PandaSettingsCard childId="c1" />));
    await waitFor(() => expect(screen.getByDisplayValue('Bambou')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu' }));
    expect(mockSetup).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Tên của Panda'), 'Bao');
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(mockSetup).toHaveBeenCalledWith('c1', 'Bao', 'kind'));
  });

  it('« garder le panda plus jeune / plus grand » : décalage −1, 0 ou +1', async () => {
    mockFetch.mockResolvedValue(parseCompanionState({ has_companion: true, name: 'Bambou', trait: 'kind', stage: 2, stage_offset: 0, energy_total: 0, level: 1, next_level_at: 50 }));
    await render(withClient(<PandaSettingsCard childId="c1" />));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Giữ Panda lớn hơn' })).toBeTruthy());
    expect(screen.getByRole('radio', { name: 'Theo tuổi của em' }).props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByRole('radio', { name: 'Giữ Panda lớn hơn' }));
    await waitFor(() => expect(mockOffset).toHaveBeenCalledWith('c1', 1));
    await fireEvent.press(screen.getByRole('radio', { name: 'Giữ Panda nhỏ hơn' }));
    await waitFor(() => expect(mockOffset).toHaveBeenCalledWith('c1', -1));
  });

  it('rien tant que l’enfant n’a pas de panda', async () => {
    mockFetch.mockResolvedValue(parseCompanionState({ has_companion: false }));
    await render(withClient(<PandaSettingsCard childId="c1" />));
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(screen.queryByRole('header', { name: 'Panda của em' })).toBeNull();
  });
});

describe('fiche de l’enfant (parent)', () => {
  it('image, nom et niveau ; le parent renomme mais ne règle jamais le stade', async () => {
    mockFetch.mockResolvedValue(parseCompanionState({ has_companion: true, name: 'Bambou', trait: 'kind', stage: 3, stage_offset: 0, energy_total: 160, level: 3, next_level_at: 300 }));
    await render(withClient(<ParentPandaCard childId="c1" childName="Minh" />));
    await waitFor(() => expect(screen.getByText('Bambou · Thân thiết cấp 3')).toBeTruthy());
    expect(screen.getByLabelText('Panda Bambou, bình tĩnh')).toBeTruthy();
    expect(screen.queryByText(/⚡|năng lượng/i)).toBeNull(); // pas de chiffre d'énergie côté parent
    expect(screen.queryByRole('radio', { name: 'Giữ Panda lớn hơn' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Đổi tên hoặc tính cách' }));
    await fireEvent.changeText(screen.getByLabelText('Tên của Panda'), 'Bao Bao');
    await fireEvent.press(screen.getByRole('radio', { name: 'Vui tính' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu tên Panda' }));
    await waitFor(() => expect(mockSetup).toHaveBeenCalledWith('c1', 'Bao Bao', 'funny'));
    expect(mockOffset).not.toHaveBeenCalled();
  });

  it('enfant sans panda : le parent peut en créer un', async () => {
    mockFetch.mockResolvedValue(parseCompanionState({ has_companion: false, stage: 1 }));
    await render(withClient(<ParentPandaCard childId="c1" childName="Minh" />));
    await waitFor(() => expect(screen.getByText('Minh chưa đặt tên cho Panda')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Đổi tên hoặc tính cách' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu tên Panda' }));
    await waitFor(() => expect(mockSetup).toHaveBeenCalledWith('c1', 'Bambou', 'curious'));
  });
});
