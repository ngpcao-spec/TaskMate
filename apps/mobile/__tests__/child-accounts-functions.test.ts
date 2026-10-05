import {
  childAuthEmail,
  createChildAccount,
  deleteChildAccount,
  resetChildPassword,
  type ChildAccountDeps,
  type Target,
} from '../../../supabase/functions/_shared/child-accounts';

const CHILD = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';
const NEW_USER = '33333333-3333-4333-8333-333333333333';
const FAMILY = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const RANDOM_ID = 'cccccccc-1111-4222-8333-444444444444';
const target = (over: Partial<Target> = {}): Target => ({ family_id: FAMILY, child_id: CHILD, child_name: 'Lan', member_id: null, login_id: null, user_id: null, ...over });

function deps(over: Partial<ChildAccountDeps> = {}) {
  const calls: string[] = [];
  const d: ChildAccountDeps = {
    target: async () => ({ data: target(), error: null }),
    createUser: async (email, pw) => (calls.push(`createUser:${email}:${pw}`), { userId: NEW_USER, error: null }),
    deleteUser: async (id) => void calls.push(`deleteUser:${id}`),
    register: async (c, u, l, e, pw) => (calls.push(`register:${c}:${u}:${l}:${e}:${pw}`), { error: null }),
    remove: async (c) => (calls.push(`remove:${c}`), { userId: USER, error: null }),
    setPassword: async (c, pw) => (calls.push(`setPassword:${c}:${pw}`), { error: false }),
    lockUser: async (u, t) => (calls.push(`lock:${u}:${t}`), { error: false }),
    softDeleteProfile: async (c) => (calls.push(`softDelete:${c}`), { error: false }),
    randomPassword: () => 'random-pw',
    randomId: () => RANDOM_ID,
    ...over,
  };
  return Object.assign(d, { calls });
}
const forbidden = { data: null, error: { code: '42501', message: 'forbidden' } };

describe('create-child', () => {
  it('adresse interne : UUID, domaine réservé, indépendante de l\'identifiant et de la famille', () => {
    expect(childAuthEmail(RANDOM_ID)).toBe(`${RANDOM_ID}@child.taskmate.invalid`);
    expect(childAuthEmail(RANDOM_ID)).not.toContain('minh');
  });

  it('crée le compte : e-mail fictif dérivé, puis enregistrement du lien', async () => {
    const d = deps();
    const r = await createChildAccount(d, { childId: CHILD, loginId: '  Lan.Hà ', password: 'secret1' });
    expect(r).toEqual({ status: 200, body: { loginId: 'lan.ha' } });
    // adresse interne = UUID aléatoire (rien de dérivable de l'identifiant) ; GoTrue reçoit un mot de passe ALÉATOIRE, jamais le vrai
    const email = `${RANDOM_ID}@child.taskmate.invalid`;
    expect(d.calls).toEqual([`createUser:${email}:random-pw`, `register:${CHILD}:${NEW_USER}:lan.ha:${email}:secret1`]);
    expect(d.calls.join('|')).not.toMatch(/lan\.ha@/);
  });

  it('un enfant (ou tout non-parent) est refusé AVANT toute création de compte', async () => {
    const d = deps({ target: async () => forbidden });
    expect(await createChildAccount(d, { childId: CHILD, loginId: 'lan', password: 'secret1' })).toEqual({ status: 403, body: { error: 'forbidden' } });
    expect(d.calls).toEqual([]); // aucune écriture, aucune clé service utilisée
  });

  it('non authentifié → 401 ; erreur inattendue → 500 ; enfant mal formé → 422', async () => {
    expect((await createChildAccount(deps({ target: async () => ({ data: null, error: { code: '28000' } }) }), { childId: CHILD, loginId: 'lan', password: 'secret1' })).status).toBe(401);
    expect((await createChildAccount(deps({ target: async () => ({ data: null, error: { code: 'XX000' } }) }), { childId: CHILD, loginId: 'lan', password: 'secret1' })).status).toBe(500);
    expect((await createChildAccount(deps(), { childId: 'pas-un-uuid', loginId: 'lan', password: 'secret1' })).status).toBe(422);
    expect((await createChildAccount(deps(), null)).status).toBe(422);
  });

  it('valide l\'identifiant et le mot de passe', async () => {
    const d = deps();
    expect(await createChildAccount(d, { childId: CHILD, loginId: 'a b', password: 'secret1' })).toEqual({ status: 422, body: { error: 'invalid_identifier' } });
    expect(await createChildAccount(d, { childId: CHILD, loginId: 'lan', password: '12345' })).toEqual({ status: 422, body: { error: 'weak_password' } });
    expect(await createChildAccount(d, { childId: CHILD, loginId: 'lan', password: 123456 })).toEqual({ status: 422, body: { error: 'weak_password' } });
    expect(d.calls).toEqual([]);
  });

  it('identifiant déjà pris (e-mail fictif existant) → 409, rien n\'est enregistré', async () => {
    const d = deps({ createUser: async () => ({ userId: null, error: 'email_exists' }) });
    expect(await createChildAccount(d, { childId: CHILD, loginId: 'lan', password: 'secret1' })).toEqual({ status: 409, body: { error: 'identifier_taken' } });
    expect(d.calls).toEqual([]);
  });

  it('conflit détecté par la base après création : le compte auth est supprimé (pas d\'orphelin)', async () => {
    const d = deps({ register: async () => ({ error: { message: 'identifier_taken' } }) });
    expect((await createChildAccount(d, { childId: CHILD, loginId: 'lan', password: 'secret1' })).body).toEqual({ error: 'identifier_taken' });
    expect(d.calls).toContain(`deleteUser:${NEW_USER}`);
    const e = deps({ register: async () => ({ error: { message: 'boom' } }) });
    expect((await createChildAccount(e, { childId: CHILD, loginId: 'lan', password: 'secret1' })).status).toBe(500);
    expect(e.calls).toContain(`deleteUser:${NEW_USER}`);
  });

  it('un enfant qui a déjà un compte → 409 sans rien créer', async () => {
    const d = deps({ target: async () => ({ data: target({ login_id: 'lan', user_id: USER }), error: null }) });
    expect(await createChildAccount(d, { childId: CHILD, loginId: 'lan2', password: 'secret1' })).toEqual({ status: 409, body: { error: 'account_exists' } });
    expect(d.calls).toEqual([]);
  });
});

describe('reset-child-password', () => {
  const withAccount = { target: async () => ({ data: target({ login_id: 'lan', user_id: USER }), error: null }) };
  it('change le mot de passe du compte de l\'enfant', async () => {
    const d = deps(withAccount);
    expect(await resetChildPassword(d, { childId: CHILD, password: 'nouveau1' })).toEqual({ status: 200, body: { ok: true } });
    expect(d.calls).toEqual([`setPassword:${CHILD}:nouveau1`]); // le haché de la base change ; GoTrue n’est pas touché
  });
  it('refuse un non-parent, un enfant sans compte et un mot de passe trop court', async () => {
    const f = deps({ target: async () => forbidden });
    expect((await resetChildPassword(f, { childId: CHILD, password: 'nouveau1' })).status).toBe(403);
    expect(f.calls).toEqual([]);
    expect(await resetChildPassword(deps(), { childId: CHILD, password: 'nouveau1' })).toEqual({ status: 404, body: { error: 'no_account' } });
    expect((await resetChildPassword(deps(withAccount), { childId: CHILD, password: '123' })).status).toBe(422);
  });
  it('erreur du service d\'authentification → 500', async () => {
    expect((await resetChildPassword(deps({ ...withAccount, setPassword: async () => ({ error: true }) }), { childId: CHILD, password: 'nouveau1' })).status).toBe(500);
  });
});

describe('delete-child', () => {
  const withAccount = { target: async () => ({ data: target({ login_id: 'lan', user_id: USER }), error: null }) };
  it('verrouille le compte (e-mail libéré, mot de passe aléatoire) puis retire le lien', async () => {
    const d = deps(withAccount);
    expect(await deleteChildAccount(d, { childId: CHILD })).toEqual({ status: 200, body: { deleted: true } });
    expect(d.calls).toEqual([`lock:${USER}:deleted-${USER}@child.taskmate.invalid`, `remove:${CHILD}`]);
  });
  it('avec deleteProfile : retire aussi le profil', async () => {
    const d = deps(withAccount);
    await deleteChildAccount(d, { childId: CHILD, deleteProfile: true });
    expect(d.calls.at(-1)).toBe(`softDelete:${CHILD}`);
  });
  it('enfant sans compte : 404, sauf suppression du profil', async () => {
    expect(await deleteChildAccount(deps(), { childId: CHILD })).toEqual({ status: 404, body: { error: 'no_account' } });
    const d = deps();
    expect((await deleteChildAccount(d, { childId: CHILD, deleteProfile: true })).status).toBe(200);
    expect(d.calls).toEqual([`softDelete:${CHILD}`]);
  });
  it('refuse un non-parent sans rien toucher', async () => {
    const d = deps({ target: async () => forbidden });
    expect((await deleteChildAccount(d, { childId: CHILD, deleteProfile: true })).status).toBe(403);
    expect(d.calls).toEqual([]);
  });
  it('échec du verrouillage : on ne retire pas le lien (rejouable)', async () => {
    const d = deps({ ...withAccount, lockUser: async () => ({ error: true }) });
    expect((await deleteChildAccount(d, { childId: CHILD })).status).toBe(500);
    expect(d.calls).toEqual([]);
  });
});
