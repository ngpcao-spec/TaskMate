import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import '@/i18n';
import SetupIndex from '../app/onboarding/setup/index';
import SetupStepScreen from '../app/onboarding/setup/[step]';
import ChildSetupScreen from '../app/onboarding/child-setup';
import { clearClients, renderWithClient } from '../test-utils/onboardingHarness';

const mockRedirect = jest.fn();
let mockParams: { step?: string } = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: { href: string }) => { mockRedirect(href); return null; },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: ReactNode }) => children }));
jest.mock('@/api/supabase', () => ({ supabase: {} }));
let mockRole: 'parent' | 'child' = 'parent';
let mockNoMe = false;
jest.mock('@/hooks/useMe', () => ({ useMe: () => ({ data: mockNoMe ? null : { member: { id: 'm1', role: mockRole }, family: { id: 'f1' }, children: [] } }) }));
const mockFetch = jest.fn();
jest.mock('@/api/onboarding', () => ({ fetchOnboarding: async () => jest.requireActual('@/domain/onboarding').parseOnboarding(await mockFetch()), setOnboardingStep: jest.fn(), hideSetupCard: jest.fn(), restartOnboarding: jest.fn() }));
const mockDevice = jest.fn();
jest.mock('@/services/webPush', () => ({ thisDeviceRegistered: () => mockDevice() }));
// étapes : leur contenu est testé ailleurs ; ici seulement le choix de l'étape
jest.mock('@/components/onboarding/LanguageStep', () => ({ LanguageStep: () => { const { Text } = jest.requireActual('react-native'); return <Text>step:language</Text>; } }));
jest.mock('@/components/onboarding/ChildrenStep', () => ({ ChildrenStep: () => { const { Text } = jest.requireActual('react-native'); return <Text>step:children</Text>; } }));
jest.mock('@/components/onboarding/SubjectsStep', () => ({ SubjectsStep: () => { const { Text } = jest.requireActual('react-native'); return <Text>step:subjects</Text>; } }));
jest.mock('@/components/onboarding/NotificationsStep', () => ({ NotificationsStep: () => { const { Text } = jest.requireActual('react-native'); return <Text>step:notifications</Text>; } }));
jest.mock('@/components/onboarding/ContentStep', () => ({ ContentStep: () => { const { Text } = jest.requireActual('react-native'); return <Text>step:content</Text>; } }));
jest.mock('@/components/onboarding/CoparentStep', () => ({ CoparentStep: () => { const { Text } = jest.requireActual('react-native'); return <Text>step:coparent</Text>; } }));
jest.mock('@/components/onboarding/ChildSetup', () => ({ ChildSetup: () => { const { Text } = jest.requireActual('react-native'); return <Text>child-setup</Text>; } }));

const kid = { id: 'c1', name: 'Minh', country: 'VN', grade: '7', subjects: ['maths'], available: ['maths'] };
const raw = (over: Record<string, unknown> = {}) => ({ is_owner: true, language_confirmed: false, skipped: [], card_hidden: false, children: [], tasks: 0, rewards: 0, parents: 1, invite_active: false, ...over });

beforeEach(() => { mockRole = 'parent'; mockNoMe = false; mockParams = {}; mockDevice.mockResolvedValue(false); mockFetch.mockResolvedValue(raw()); });
afterEach(() => { clearClients(); jest.clearAllMocks(); });

describe('Entrée de l’assistant (reprise)', () => {
  it('famille neuve : reprend à la langue', async () => {
    await renderWithClient(<SetupIndex />);
    await waitFor(() => expect(mockRedirect).toHaveBeenCalledWith('/onboarding/setup/language'));
  });
  it('langue confirmée, aucun enfant : reprend à l’étape enfants (obligatoire)', async () => {
    mockFetch.mockResolvedValue(raw({ language_confirmed: true }));
    await renderWithClient(<SetupIndex />);
    await waitFor(() => expect(mockRedirect).toHaveBeenCalledWith('/onboarding/setup/children'));
  });
  it('reprend à la première étape à faire d’après les données (étapes passées ignorées)', async () => {
    mockFetch.mockResolvedValue(raw({ language_confirmed: true, children: [kid], skipped: ['notifications'] }));
    await renderWithClient(<SetupIndex />);
    await waitFor(() => expect(mockRedirect).toHaveBeenCalledWith('/onboarding/setup/content'));
  });
  it('tout est fait : retour à Hôm nay', async () => {
    mockDevice.mockResolvedValue(true);
    mockFetch.mockResolvedValue(raw({ language_confirmed: true, children: [kid], tasks: 1, rewards: 1, parents: 2 }));
    await renderWithClient(<SetupIndex />);
    await waitFor(() => expect(mockRedirect).toHaveBeenCalledWith('/(tabs)/today'));
  });
  it('lecture impossible : on atterrit sur la première étape qui affiche l’erreur', async () => {
    mockFetch.mockResolvedValue(null);
    await renderWithClient(<SetupIndex />);
    await waitFor(() => expect(mockRedirect).toHaveBeenCalledWith('/onboarding/setup/language'));
  });
  it('un enfant n’y entre jamais', async () => {
    mockRole = 'child';
    await renderWithClient(<SetupIndex />);
    expect(mockRedirect).toHaveBeenCalledWith('/');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('Route /onboarding/setup/[step]', () => {
  it('affiche chacune des six étapes', async () => {
    for (const step of ['language', 'children', 'subjects', 'notifications', 'content', 'coparent']) {
      mockParams = { step };
      const { unmount } = await renderWithClient(<SetupStepScreen />);
      expect(await screen.findByText(`step:${step}`)).toBeTruthy();
      await unmount();
    }
  });
  it('étape inconnue : retour à l’entrée de l’assistant', async () => {
    mockParams = { step: 'inconnue' };
    await renderWithClient(<SetupStepScreen />);
    await waitFor(() => expect(mockRedirect).toHaveBeenCalledWith('/onboarding/setup'));
  });
  it('parent INVITÉ : seulement langue et notifications ; les autres étapes renvoient à l’entrée', async () => {
    mockFetch.mockResolvedValue(raw({ is_owner: false, parents: 2 }));
    mockParams = { step: 'children' };
    await renderWithClient(<SetupStepScreen />);
    await waitFor(() => expect(mockRedirect).toHaveBeenCalledWith('/onboarding/setup'));
    clearClients();
    mockRedirect.mockClear();
    mockParams = { step: 'notifications' };
    await renderWithClient(<SetupStepScreen />);
    expect(await screen.findByText('step:notifications')).toBeTruthy();
  });
  it('un enfant est renvoyé à l’accueil, sans lecture', async () => {
    mockRole = 'child';
    mockParams = { step: 'language' };
    await renderWithClient(<SetupStepScreen />);
    expect(mockRedirect).toHaveBeenCalledWith('/');
    expect(mockFetch).not.toHaveBeenCalled();
  });
  it('`me` pas encore (re)lu — cache périmé « aucune famille » (D-098) : un indicateur de chargement, jamais un écran vide', async () => {
    mockNoMe = true;
    mockParams = { step: 'language' };
    await renderWithClient(<SetupStepScreen />);
    expect(screen.getByLabelText('Đang tải…')).toBeTruthy();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(screen.queryByText('step:language')).toBeNull();
  });
  it('lecture impossible : message et « Thử lại »', async () => {
    mockFetch.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(raw());
    mockParams = { step: 'language' };
    await renderWithClient(<SetupStepScreen />);
    expect(await screen.findByText('Không tải được trình hướng dẫn.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('step:language')).toBeTruthy();
  });
});

describe('Route /onboarding/child-setup', () => {
  it('enfant : le mini-parcours ; parent : redirigé', async () => {
    mockRole = 'child';
    await renderWithClient(<ChildSetupScreen />);
    expect(screen.getByText('child-setup')).toBeTruthy();
    clearClients();
    mockRole = 'parent';
    mockRedirect.mockClear();
    await renderWithClient(<ChildSetupScreen />);
    expect(mockRedirect).toHaveBeenCalledWith('/');
  });
});
