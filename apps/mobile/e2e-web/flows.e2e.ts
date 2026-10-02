import { expect, test, type Page } from '@playwright/test';
import { createFamily, seedInvite, seedTask, serverState, signInContext, supabaseUrl } from './support/seed';

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode = () => Array.from({ length: 6 }, () => INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)]).join('');
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

async function open(page: Page, path = '/') {
  await page.goto(path);
}

test.describe('validation parentale (spec v4)', () => {
  test('le parent crée une tâche, l\'enfant coche, le parent valide, les points sont crédités une fois', async ({ browser }) => {
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

    // 3. parent : valide depuis la file « Cần duyệt »
    await open(parent, '/approvals');
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

test.describe('jointure par lien', () => {
  test('/join?code=… ouvre directement la jointure enfant', async ({ browser }) => {
    const family = await createFamily();
    const code = randomCode();
    await seedInvite(family, 'minh', code);

    const ctx = await browser.newContext(); // aucun compte : session anonyme créée par l'app
    const page = await ctx.newPage();
    await open(page, `/join?code=${code}`);
    await expect(page).toHaveURL(/\/onboarding\/join/);
    await expect(page.getByText('Bạn là Minh?')).toBeVisible();
    await page.getByRole('button', { name: 'Đúng, vào ứng dụng' }).click();
    await expect(page.getByText('Chào Minh!')).toBeVisible();
  });

  test('un code invalide affiche l\'erreur et garde la saisie manuelle', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await open(page, `/join?code=${randomCode()}`);
    await expect(page.getByText('Mã không hợp lệ hoặc đã hết hạn')).toBeVisible();
    await expect(page.getByLabel('Mã 6 ký tự')).toBeVisible();
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
