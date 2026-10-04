import { expect, test, type Page } from '@playwright/test';
import { createFamily, revokeChildMembers, seedTask, serverState, signInContext, supabaseUrl } from './support/seed';

const title = (label: string) => `${label} ${Math.random().toString(36).slice(2, 7)}`;

/** Diagnostic : journalise les réponses Supabase en erreur et les erreurs console (visible dans la sortie CI). */
function trace(page: Page, who: string) {
  page.on('response', async (res) => {
    if (res.status() >= 400 && res.url().includes('/rest/v1/')) console.log(`[${who}] ${res.status()} ${res.request().method()} ${res.url().replace(/^.*\/rest\/v1\//, '')} ${(await res.text().catch(() => '')).slice(0, 300)}`);
  });
  page.on('console', (m) => {
    if (m.type() === 'error') console.log(`[${who}] console.error ${m.text().slice(0, 300)}`);
  });
  page.on('pageerror', (e) => console.log(`[${who}] pageerror ${e.message.slice(0, 300)}`));
}

/** Diagnostic CI : si l'attente échoue, journalise l'URL et le texte de la page avant de relancer l'erreur. */
async function expectVisibleOrDump(page: Page, locator: ReturnType<Page['getByLabel']>, who: string, timeout = 20_000) {
  try {
    await expect(locator).toBeVisible({ timeout });
  } catch (e) {
    console.log(`[${who}] introuvable — url=${page.url()} texte=${(await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 600)}`);
    throw e;
  }
}

async function open(page: Page, path = '/') {
  await page.goto(path);
}

test.describe('validation parentale (spec v4)', () => {
  test('le parent crée une tâche, l\'enfant coche, le parent valide, les points sont crédités une fois', async ({ browser }) => {
    test.setTimeout(120_000);
    const family = await createFamily();
    const taskTitle = title('Đọc sách');

    // 1. parent : crée la tâche via l'interface
    const parentCtx = await browser.newContext();
    await signInContext(parentCtx, family.parent);
    const parent = await parentCtx.newPage();
    await open(parent);
    await expect(parent.getByText('Chào Minh!')).toBeVisible();
    await parent.getByRole('button', { name: 'Thêm việc' }).click();
    await parent.getByLabel('Tên công việc').fill(taskTitle);
    await parent.getByRole('button', { name: 'Lưu' }).click();
    await expect(parent.getByRole('checkbox', { name: taskTitle })).toBeVisible();

    // 2. enfant : coche → « Chờ duyệt », aucun point
    const childCtx = await browser.newContext();
    await signInContext(childCtx, family.minh);
    const child = await childCtx.newPage();
    trace(child, 'enfant');
    await open(child);
    const box = child.getByRole('checkbox', { name: taskTitle });
    await expect(box).toBeVisible();
    await box.click();
    await expect(box).toBeChecked();
    await expect(child.getByText('Chờ duyệt').first()).toBeVisible();
    await expect.poll(async () => (await serverState(family, 'minh', taskTitle)).completed).toBe(true);
    expect(await serverState(family, 'minh', taskTitle)).toMatchObject({ validated: false, balance: 0, transactions: 0 });
    await open(child, '/more/points');
    await expect(child.getByLabel('0 điểm', { exact: true })).toBeVisible();
    await expect(child.getByText('+10 điểm chờ duyệt')).toBeVisible();

    // 3. parent : la bannière « 1 việc chờ duyệt » apparaît (Realtime, sans recharger) puis valide depuis la file « Cần duyệt »
    trace(parent, 'parent');
    await expectVisibleOrDump(parent, parent.getByRole('button', { name: '1 việc chờ duyệt' }), 'parent', 15_000);
    await parent.getByRole('button', { name: '1 việc chờ duyệt' }).click({ timeout: 15_000 });
    await expect(parent).toHaveURL(/\/approvals/);
    await parent.getByRole('button', { name: `Duyệt ${taskTitle}` }).click();
    await expect.poll(async () => (await serverState(family, 'minh', taskTitle)).validated).toBe(true);
    expect(await serverState(family, 'minh', taskTitle)).toMatchObject({ balance: 10, transactions: 1 }); // crédité une seule fois

    // 4. enfant : le solde apparaît
    await open(child, '/more/points');
    await expect(child.getByLabel('10 điểm', { exact: true })).toBeVisible();
  });

  test('l\'enfant hors ligne : la coche reste « Chờ duyệt » puis part une seule fois au retour du réseau', async ({ browser }) => {
    const family = await createFamily();
    const taskTitle = title('Dọn phòng');
    await seedTask(family, 'minh', taskTitle);

    const ctx = await browser.newContext();
    await signInContext(ctx, family.minh);
    const page = await ctx.newPage();
    trace(page, 'enfant-hors-ligne');
    await open(page);
    const box = page.getByRole('checkbox', { name: taskTitle });
    await expect(box).toBeVisible();

    await ctx.setOffline(true);
    await box.click();
    await expect(box).toBeChecked(); // effet local immédiat, jamais de point côté enfant
    await expect(page.getByText('Chờ duyệt').first()).toBeVisible();
    expect((await serverState(family, 'minh', taskTitle)).completed).toBe(false); // rien n'est parti

    await ctx.setOffline(false);
    await expect.poll(async () => (await serverState(family, 'minh', taskTitle)).completed, { timeout: 30_000 }).toBe(true);
    expect(await serverState(family, 'minh', taskTitle)).toMatchObject({ validated: false, balance: 0, transactions: 0 });
  });
});

test.describe('droits de l\'enfant', () => {
  test('le frère est consultable en lecture seule ; l\'enfant ne peut pas créer de tâche', async ({ browser }) => {
    const family = await createFamily();
    const khangTask = title('Tập đàn');
    await seedTask(family, 'khang', khangTask);

    const ctx = await browser.newContext();
    await signInContext(ctx, family.minh);
    const page = await ctx.newPage();
    await open(page);
    await expect(page.getByText('Chào Minh!')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Thêm việc' })).toHaveCount(0);

    await page.getByRole('tab', { name: /Khang/ }).click();
    await expect(page.getByText('Đang xem lịch của Khang')).toBeVisible();
    const box = page.getByRole('checkbox', { name: khangTask });
    await expect(box).toBeVisible();
    await expect(box).toBeDisabled();

    // route de création protégée
    await open(page, '/task/new');
    await expect(page.getByLabel('Tên công việc')).toHaveCount(0);
  });
});

test.describe('comptes e-mail / identifiant (aucune invitation)', () => {
  const LOGIN_FIELD = 'Tên đăng nhập (chữ, số, . _ -)';
  const PASSWORD_FIELD = 'Mật khẩu (tối thiểu 6 ký tự)';

  async function childSignIn(browser: import('@playwright/test').Browser, loginId: string, password: string) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await open(page);
    await page.getByRole('button', { name: 'Bắt đầu' }).click();
    await page.getByRole('button', { name: 'Tôi là con' }).click();
    await page.getByLabel('Tên đăng nhập', { exact: true }).fill(loginId);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    return page;
  }

  test('le parent s\'inscrit, crée le compte d\'un enfant, qui se connecte avec identifiant + mot de passe ; mot de passe changé puis compte supprimé', async ({ browser }) => {
    test.setTimeout(180_000);
    const tag = Math.random().toString(36).slice(2, 8);
    const loginId = `bin.${tag}`;

    // parent : inscription e-mail + mot de passe (aucun e-mail envoyé), famille, enfant
    const parentCtx = await browser.newContext();
    const parent = await parentCtx.newPage();
    trace(parent, 'parent');
    await open(parent);
    await parent.getByRole('button', { name: 'Bắt đầu' }).click();
    await parent.getByRole('button', { name: 'Tôi là phụ huynh' }).click();
    await parent.getByLabel('Email', { exact: true }).fill(`ba-${tag}@e2e.test`);
    await parent.getByLabel('Mật khẩu', { exact: true }).fill('motdepasse-1');
    await parent.getByRole('button', { name: 'Tạo tài khoản' }).click();
    await parent.getByLabel('Tên gia đình').fill(`Gia đình ${tag}`);
    await parent.getByLabel('Tên của bạn').fill('Ba');
    await parent.getByRole('button', { name: 'Tiếp tục' }).click();
    await expectVisibleOrDump(parent, parent.getByLabel('Tên của con'), 'parent');
    await parent.getByLabel('Tên của con').fill('Bin');
    await parent.getByLabel('Ngày sinh (YYYY-MM-DD)').fill('2012-05-01');
    await parent.getByRole('button', { name: 'Thêm con' }).click();

    // le parent crée le compte de Bin dans l'app
    await parent.getByLabel(LOGIN_FIELD).fill(loginId);
    await parent.getByLabel(PASSWORD_FIELD).fill('abc123');
    await parent.getByRole('button', { name: 'Tạo tài khoản Bin' }).click();
    await expect(parent.getByText(`Tên đăng nhập: ${loginId}`)).toBeVisible({ timeout: 20_000 });

    // l'enfant se connecte sur son propre appareil
    const child = await childSignIn(browser, loginId, 'abc123');
    await expect(child.getByText('Chào Bin!')).toBeVisible({ timeout: 20_000 });

    // mauvais mot de passe refusé
    const wrong = await childSignIn(browser, loginId, 'mauvais1');
    await expect(wrong.getByText('Tên đăng nhập hoặc mật khẩu không đúng.')).toBeVisible();

    // le parent change le mot de passe : l'ancien ne marche plus, le nouveau oui
    await parent.getByLabel('Mật khẩu mới').fill('nouveau1');
    await parent.getByRole('button', { name: 'Đổi mật khẩu Bin' }).click();
    await expect(parent.getByText('Đã đổi mật khẩu')).toBeVisible({ timeout: 20_000 });
    const oldPw = await childSignIn(browser, loginId, 'abc123');
    await expect(oldPw.getByText('Tên đăng nhập hoặc mật khẩu không đúng.')).toBeVisible();
    const newPw = await childSignIn(browser, loginId, 'nouveau1');
    await expect(newPw.getByText('Chào Bin!')).toBeVisible({ timeout: 20_000 });

    // le parent supprime le compte : connexion impossible, identifiant libéré
    parent.once('dialog', (d) => void d.accept());
    await parent.getByRole('button', { name: 'Xóa tài khoản Bin' }).click();
    await expect(parent.getByLabel(LOGIN_FIELD)).toBeVisible({ timeout: 20_000 });
    const gone = await childSignIn(browser, loginId, 'nouveau1');
    await expect(gone.getByText('Tên đăng nhập hoặc mật khẩu không đúng.')).toBeVisible();
    await parent.getByLabel(LOGIN_FIELD).fill(loginId);
    await parent.getByLabel(PASSWORD_FIELD).fill('abc123');
    await parent.getByRole('button', { name: 'Tạo tài khoản Bin' }).click();
    await expect(parent.getByText(`Tên đăng nhập: ${loginId}`)).toBeVisible({ timeout: 20_000 });
  });

  test('« tên đăng nhập đã có người dùng » est signalé', async ({ browser }) => {
    const tag = Math.random().toString(36).slice(2, 8);
    const family = await createFamily();
    await revokeChildMembers(family); // profils sans compte de connexion
    const ctx = await browser.newContext();
    await signInContext(ctx, family.parent);
    const page = await ctx.newPage();
    await open(page, '/more/children');
    // premier enfant (Minh) : compte créé ; second (Khang) : même identifiant refusé
    await page.getByLabel(LOGIN_FIELD).first().fill(`dup.${tag}`);
    await page.getByLabel(PASSWORD_FIELD).first().fill('abc123');
    await page.getByRole('button', { name: 'Tạo tài khoản Minh' }).click();
    await expect(page.getByText(`Tên đăng nhập: dup.${tag}`)).toBeVisible({ timeout: 20_000 });
    await page.getByLabel(LOGIN_FIELD).fill(`dup.${tag}`);
    await page.getByLabel(PASSWORD_FIELD).fill('abc123');
    await page.getByRole('button', { name: 'Tạo tài khoản Khang' }).click();
    await expect(page.getByText('Tên đăng nhập này đã có người dùng. Hãy chọn tên khác.')).toBeVisible({ timeout: 20_000 });
  });

  test('un enfant ne peut ni créer, ni modifier, ni supprimer un compte (Edge Functions)', async () => {
    const family = await createFamily();
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(supabaseUrl(), process.env.E2E_ANON_KEY as string, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email: family.minh.email, password: family.minh.password });
    expect(error).toBeNull();
    const call = async (fn: string, body: Record<string, unknown>) => {
      const res = await fetch(`${supabaseUrl()}/functions/v1/${fn}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: process.env.E2E_ANON_KEY as string, Authorization: `Bearer ${data.session?.access_token}` },
        body: JSON.stringify(body),
      });
      return { status: res.status, body: (await res.json()) as { error?: string } };
    };
    const childId = family.khang.childId as string;
    expect(await call('create-child', { childId, loginId: 'pirate.khang', password: 'abc123' })).toMatchObject({ status: 403, body: { error: 'forbidden' } });
    expect(await call('reset-child-password', { childId, password: 'abc123' })).toMatchObject({ status: 403, body: { error: 'forbidden' } });
    expect(await call('delete-child', { childId })).toMatchObject({ status: 403, body: { error: 'forbidden' } });
  });
});

test.describe('mise en page bureau', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('la file « Cần duyệt » affiche Tâches et Récompenses côte à côte', async ({ browser }) => {
    const family = await createFamily();
    const taskTitle = title('Rửa bát');
    const taskId = await seedTask(family, 'minh', taskTitle);
    const { createClient } = await import('@supabase/supabase-js');
    const childClient = createClient(supabaseUrl(), process.env.E2E_ANON_KEY as string, { auth: { persistSession: false } });
    await childClient.auth.signInWithPassword({ email: family.minh.email, password: family.minh.password });
    const { error } = await childClient.rpc('complete_task', { p_task_id: taskId, p_tx_id: crypto.randomUUID() });
    expect(error).toBeNull();

    const ctx = await browser.newContext();
    await signInContext(ctx, family.parent);
    const page = await ctx.newPage();
    await open(page, '/approvals');
    await expect(page.getByRole('heading', { name: 'Việc (1)' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Phần thưởng (0)' })).toBeVisible();
    await expect(page.getByRole('button', { name: `Duyệt ${taskTitle}` })).toBeVisible();
  });
});

test.describe('accessibilité clavier', () => {
  test('Tab atteint les boutons avec un focus visible, Entrée les active', async ({ browser }) => {
    const family = await createFamily();
    const ctx = await browser.newContext();
    await signInContext(ctx, family.parent);
    const page = await ctx.newPage();
    await open(page);
    await expect(page.getByText('Chào Minh!')).toBeVisible();

    let reachedBell = false;
    for (let i = 0; i < 25 && !reachedBell; i += 1) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        return { label: el.getAttribute('aria-label') ?? '', visible: el.matches(':focus-visible') && getComputedStyle(el).outlineStyle !== 'none' };
      });
      if (info) expect(info.visible).toBe(true);
      reachedBell = !!info?.label.startsWith('Thông báo');
    }
    expect(reachedBell).toBe(true);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/notifications/);
  });
});

test.describe('diagnostic de production', () => {
  test('Réglages → Diagnostic vérifie le serveur et signale une adresse Supabase locale', async ({ browser }) => {
    const family = await createFamily();
    const ctx = await browser.newContext();
    await signInContext(ctx, family.parent);
    const page = await ctx.newPage();
    await open(page, '/more/settings');
    await page.getByRole('button', { name: 'Chẩn đoán' }).click(); // libellé du bouton dans la langue de l'app (vi)
    await expect(page.getByRole('heading', { name: 'Diagnostic' })).toBeVisible();
    for (const label of ['Connexion à Supabase', 'Confirmation d\'e-mail désactivée', 'Tables', 'Fonctions SQL \\(RPC\\)', 'Sécurité des lignes \\(RLS\\)', 'Realtime : tables publiées', 'Realtime : connexion', 'Edge Function create-child', 'Edge Function reset-child-password', 'Edge Function delete-child', 'Edge Function delete-account', 'Edge Function send-push']) {
      await expect(page.getByLabel(new RegExp(`^${label} : OK`))).toBeVisible({ timeout: 20_000 });
    }
    // le front de test est construit contre 127.0.0.1 : le diagnostic doit le dire
    await expect(page.getByLabel(/^Adresse Supabase de l'application : À corriger/)).toBeVisible();
  });
});
