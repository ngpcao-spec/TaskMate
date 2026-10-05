import { AuthFlowError, signInChild, signInParent } from '@/api/auth';
import { startGoogleSignIn } from '@/api/googleAuth';
import { startGoogleSignIn as startGoogleSignInWeb } from '@/api/googleAuth.web';

const mockInvoke = jest.fn();
const mockSetSession = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockSignInWithOAuth = jest.fn();
jest.mock('@/api/supabase', () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => mockInvoke(...a) },
    auth: {
      setSession: (...a: unknown[]) => mockSetSession(...a),
      signInWithPassword: (...a: unknown[]) => mockSignInWithPassword(...a),
      signInWithOAuth: (...a: unknown[]) => mockSignInWithOAuth(...a),
    },
  },
}));
jest.mock('@/config', () => ({ config: { webUrl: '' } }));


const httpError = (status: number) => ({ error: { context: { status } }, data: null });

describe('connexion enfant (Edge Function child-login)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetSession.mockResolvedValue({ error: null });
  });

  it('envoie e-mail du parent (rogné), identifiant et mot de passe, puis ouvre la session reçue', async () => {
    mockInvoke.mockResolvedValue({ data: { session: { access_token: 'at', refresh_token: 'rt' } }, error: null });
    await signInChild(' parent@example.com ', 'Minh', 'secret1');
    expect(mockInvoke).toHaveBeenCalledWith('child-login', { body: { parentEmail: 'parent@example.com', loginId: 'Minh', password: 'secret1' } });
    expect(mockSetSession).toHaveBeenCalledWith({ access_token: 'at', refresh_token: 'rt' });
  });

  it('401 → identifiants invalides ; 429 → trop d\'essais ; autre → erreur ; coupure réseau → réseau', async () => {
    const kind = async () => signInChild('p@e.com', 'x', 'y').then(() => 'ok', (e: unknown) => (e as AuthFlowError).kind);
    mockInvoke.mockResolvedValue(httpError(401));
    expect(await kind()).toBe('invalidCredentials');
    mockInvoke.mockResolvedValue(httpError(429));
    expect(await kind()).toBe('tooManyAttempts');
    mockInvoke.mockResolvedValue(httpError(500));
    expect(await kind()).toBe('unknown');
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'Failed to send a request to the Edge Function' } });
    expect(await kind()).toBe('network');
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it('réponse sans session ou session refusée : jamais connecté', async () => {
    mockInvoke.mockResolvedValue({ data: {}, error: null });
    await expect(signInChild('p@e.com', 'x', 'y')).rejects.toMatchObject({ kind: 'invalidCredentials' });
    mockInvoke.mockResolvedValue({ data: { session: { access_token: 'a', refresh_token: 'b' } }, error: null });
    mockSetSession.mockResolvedValue({ error: { message: 'bad' } });
    await expect(signInChild('p@e.com', 'x', 'y')).rejects.toMatchObject({ kind: 'unknown' });
  });
});

describe('connexion parent', () => {
  it('parent historique : e-mail + mot de passe ; il n\'existe plus d\'inscription par e-mail', async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null });
    await signInParent(' ba@example.com ', 'motdepasse1');
    expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: 'ba@example.com', password: 'motdepasse1' });
    expect(jest.requireActual('@/api/auth')).not.toHaveProperty('signUpParent');
    mockSignInWithPassword.mockResolvedValue({ error: { code: 'invalid_credentials', status: 400, message: 'x' } });
    await expect(signInParent('a@b.c', 'x')).rejects.toMatchObject({ kind: 'invalidCredentials' });
  });

  it('Google (web) : signInWithOAuth, provider google, redirectTo = URL du site', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null });
    Object.defineProperty(globalThis, 'window', { value: { location: { origin: 'https://taskmate.example' } }, configurable: true });
    await startGoogleSignInWeb();
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: 'https://taskmate.example' } });
    mockSignInWithOAuth.mockResolvedValue({ error: { message: 'boom' } });
    await expect(startGoogleSignInWeb()).rejects.toBeInstanceOf(AuthFlowError);
  });

  it('Google (natif) : indisponible, message clair', async () => {
    await expect(startGoogleSignIn()).rejects.toMatchObject({ kind: 'googleUnavailable' });
  });
});
