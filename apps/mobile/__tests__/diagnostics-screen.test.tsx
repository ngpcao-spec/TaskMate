import { fireEvent, render, screen } from '@testing-library/react-native';
import '@/i18n';
import DiagnosticsScreen from '../app/(tabs)/more/diagnostics';
import { evaluateHealth, summarize, EXPECTED_FUNCTIONS, EXPECTED_TABLES, type Probes } from '@/domain/health';

jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), canGoBack: () => true, replace: jest.fn() }) }));

let mockRole: 'parent' | 'child' = 'parent';
jest.mock('@/hooks/useDisplayedChild', () => ({ useDisplayedChild: () => ({ viewer: { role: mockRole } }) }));
const mockRefetch = jest.fn();
let mockData: ReturnType<typeof build> | undefined;
jest.mock('@/hooks/useHealth', () => ({ useHealth: () => ({ data: mockData, isFetching: false, refetch: mockRefetch }) }));

const probes = (over: Partial<Probes> = {}): Probes => ({
  reachable: true,
  auth: { anonymousUsers: false, email: true },
  diagnostics: { ok: true, data: { tables: [...EXPECTED_TABLES], tables_without_rls: [], functions: EXPECTED_FUNCTIONS.filter((f) => f !== 'validate_task'), realtime_tables: ['tasks'], extensions: [], cron_jobs: null } },
  realtime: 'SUBSCRIBED',
  functions: { 'redeem-invite': true, 'delete-account': false, 'send-push': null },
  ...over,
});
const build = (p: Probes) => {
  const items = evaluateHealth(p, { supabaseUrl: 'https://x.supabase.co', webUrl: '', vapidPublicKey: '' });
  return { items, summary: summarize(items) };
};

describe('Réglages → Diagnostic', () => {
  beforeEach(() => {
    mockRole = 'parent';
    mockData = build(probes());
  });

  it('affiche en français ce qui manque et où cliquer', async () => {
    await render(<DiagnosticsScreen />);
    expect(screen.getByText(/Les connexions anonymes sont DÉSACTIVÉES/)).toBeTruthy();
    expect(screen.getByText(/Allow anonymous sign-ins/)).toBeTruthy();
    expect(screen.getByText(/Fonctions SQL manquantes : validate_task/)).toBeTruthy();
    expect(screen.getByText(/Non publiées en Realtime/)).toBeTruthy();
    expect(screen.getByText(/delete-account n'est PAS déployée/)).toBeTruthy();
    expect(screen.getByText(/select public\.schedule_cron_jobs\(\);/)).toBeTruthy();
    expect(screen.getByText(/à corriger/)).toBeTruthy();
  });

  it('chaque constat a un libellé accessible complet (titre, état, consigne)', async () => {
    await render(<DiagnosticsScreen />);
    expect(screen.getByLabelText(/Connexions anonymes : À corriger\. Les connexions anonymes sont DÉSACTIVÉES/)).toBeTruthy();
  });

  it('« Relancer le diagnostic » relance les sondes', async () => {
    await render(<DiagnosticsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Relancer le diagnostic' }));
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('tout est en ordre : message de succès', async () => {
    mockData = build(
      probes({
        auth: { anonymousUsers: true, email: true },
        diagnostics: { ok: true, data: { tables: [...EXPECTED_TABLES], tables_without_rls: [], functions: [...EXPECTED_FUNCTIONS], realtime_tables: ['tasks', 'goals', 'rewards', 'reward_requests', 'point_transactions', 'children'], extensions: [], cron_jobs: ['expire-reward-requests', 'generate-recurrences'] } },
        functions: { 'redeem-invite': true, 'delete-account': true, 'send-push': true },
      }),
    );
    mockData = { ...mockData, items: mockData.items.filter((i) => i.status === 'ok'), summary: { ok: mockData.items.length, warn: 0, fail: 0 } };
    await render(<DiagnosticsScreen />);
    expect(screen.getByText('Tout est en ordre.')).toBeTruthy();
  });

  it('réservé aux parents : rien n\'est rendu pour un enfant', async () => {
    mockRole = 'child';
    await render(<DiagnosticsScreen />);
    expect(screen.queryByRole('button', { name: 'Relancer le diagnostic' })).toBeNull();
  });
});
