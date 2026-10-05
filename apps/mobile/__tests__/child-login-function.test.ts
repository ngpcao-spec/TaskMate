import { childLogin, clientIp, INVALID_CREDENTIALS, normalizeLoginId, TOO_MANY_ATTEMPTS, type ChildLoginDeps, type LoginPlan } from '../../../supabase/functions/_shared/child-login';
import { normalizeLoginId as clientNormalize } from '@/domain/child-account';

const PLAN: LoginPlan = { locked: false, family_key: 'f:1', ip_key: 'i:abc', auth_email: 'minh@child.taskmate.invalid' };
const SESSION = { access_token: 'at', refresh_token: 'rt', expires_in: 3600, token_type: 'bearer', user: { id: 'secret-user' } };

function deps(over: Partial<ChildLoginDeps> = {}) {
  const calls: string[] = [];
  const d: ChildLoginDeps = {
    prepare: async (ip, email, id) => (calls.push(`prepare:${ip}:${email}:${id}`), { data: PLAN, error: false }),
    recordFailure: async (ipKey, familyKey) => void calls.push(`fail:${ipKey}:${familyKey}`),
    signIn: async (email, pw) => (calls.push(`signIn:${email}:${pw}`), { session: SESSION }),
    ...over,
  };
  return Object.assign(d, { calls });
}
const body = { parentEmail: ' Parent@Test ', loginId: ' Minh ', password: 'secret1' };

describe('child-login', () => {
  it('connecte : e-mail de parent et identifiant normalisés, session renvoyée (sans les données utilisateur)', async () => {
    const d = deps();
    const r = await childLogin(d, '1.2.3.4', body);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ session: { access_token: 'at', refresh_token: 'rt', expires_in: 3600, token_type: 'bearer' } });
    expect(d.calls).toEqual(['prepare:1.2.3.4:parent@test:minh', 'signIn:minh@child.taskmate.invalid:secret1']);
  });

  it('identifiant normalisé comme le client (minuscules, sans accents)', () => {
    for (const raw of ['Lan.Hà', ' ĐỨC ', 'minh_nguyễn', 'MINH']) expect(normalizeLoginId(raw)).toBe(clientNormalize(raw));
  });

  it('TOUT échec d\'identification renvoie exactement la même réponse (e-mail faux, identifiant faux, mot de passe faux, champ manquant)', async () => {
    const wrongPassword = await childLogin(deps({ signIn: async () => ({ session: null }) }), '1.1.1.1', body);
    const unknownAccount = await childLogin(deps({ prepare: async () => ({ data: { ...PLAN, auth_email: null }, error: false }) }), '1.1.1.1', body);
    const missing = [
      await childLogin(deps(), '1.1.1.1', { ...body, parentEmail: '' }),
      await childLogin(deps(), '1.1.1.1', { ...body, loginId: undefined }),
      await childLogin(deps(), '1.1.1.1', { ...body, password: '' }),
      await childLogin(deps(), '1.1.1.1', null),
      await childLogin(deps(), '1.1.1.1', { parentEmail: 42, loginId: {}, password: [] }),
    ];
    for (const r of [wrongPassword, unknownAccount, ...missing]) expect(r).toEqual({ status: 401, body: { error: INVALID_CREDENTIALS } });
  });

  it('chaque échec est journalisé (IP + famille) ; le mot de passe n\'est jamais vérifié pour un compte introuvable', async () => {
    const d = deps({ prepare: async () => ({ data: { ...PLAN, auth_email: null }, error: false }) });
    await childLogin(d, '1.1.1.1', body);
    expect(d.calls).toEqual(['fail:i:abc:f:1']); // pas de signIn
    const e = deps({ signIn: async () => ({ session: null }) });
    await childLogin(e, '1.1.1.1', body);
    expect(e.calls.at(-1)).toBe('fail:i:abc:f:1');
    const ok = deps();
    await childLogin(ok, '1.1.1.1', body);
    expect(ok.calls.some((c) => c.startsWith('fail'))).toBe(false);
  });

  it('verrouillé (IP ou famille) : 429 AVANT toute vérification de mot de passe, même avec les bons identifiants', async () => {
    const d = deps({ prepare: async () => ({ data: { ...PLAN, locked: true, auth_email: null }, error: false }) });
    expect(await childLogin(d, '1.1.1.1', body)).toEqual({ status: 429, body: { error: TOO_MANY_ATTEMPTS } });
    expect(d.calls).toEqual([]); // aucun signIn, aucun nouvel échec journalisé
  });

  it('erreur de la base : 500, jamais une session', async () => {
    expect((await childLogin(deps({ prepare: async () => ({ data: null, error: true }) }), '1.1.1.1', body)).status).toBe(500);
  });

  it('entrées démesurées tronquées (pas de coût disproportionné)', async () => {
    const d = deps();
    await childLogin(d, '1.1.1.1', { parentEmail: 'a'.repeat(5000), loginId: 'b'.repeat(5000), password: 'c'.repeat(5000) });
    const [, email, id] = (d.calls[0] as string).split(':').slice(0, 4).concat();
    expect((email as string).length).toBeLessThanOrEqual(200);
    expect((id as string).length).toBeLessThanOrEqual(200);
  });

  it('IP du client : premier élément de x-forwarded-for, sinon en-têtes de repli, sinon « unknown »', () => {
    const h = (m: Record<string, string>) => ({ get: (k: string) => m[k] ?? null });
    expect(clientIp(h({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1' }))).toBe('9.9.9.9');
    expect(clientIp(h({ 'cf-connecting-ip': '8.8.8.8' }))).toBe('8.8.8.8');
    expect(clientIp(h({}))).toBe('unknown');
  });
});
