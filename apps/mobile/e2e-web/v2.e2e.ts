import { expect, test, type Page } from '@playwright/test';
import { adventuresOf, createFamily, seedCompanion, seedEnergy, seedTask, serverState, serviceClient, signInContext } from './support/seed';

/**
 * Interface V2 « style Finch » (D-106) : une famille passée en `v2` (seed). Les E2E V1 (`flows.e2e.ts`) restent ceux de l'interface par défaut.
 */
const title = (label: string) => `${label} ${Math.random().toString(36).slice(2, 7)}`;

async function openChild(browser: import('@playwright/test').Browser, family: Awaited<ReturnType<typeof createFamily>>): Promise<Page> {
  const ctx = await browser.newContext();
  await signInContext(ctx, family.minh);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[v2-enfant] pageerror ${e.message.slice(0, 300)}`));
  page.on('dialog', (d) => void d.accept()); // confirmations (window.confirm sur le web)
  await page.goto('/');
  await expect(page).toHaveURL(/\/v2\/child\/home/, { timeout: 20_000 });
  return page;
}

test.describe('interface V2 : enfant (D-106)', () => {
  test('l\'enfant coche toutes ses tâches : la carte de fin de journée remplace la liste, « Xem lại » la rouvre', async ({ browser }) => {
    test.setTimeout(120_000);
    const family = await createFamily({ uiVersion: 'v2' });
    await seedCompanion(family, 'minh', 'Bambou');
    const a = title('Đánh răng');
    const b = title('Đọc sách');
    await seedTask(family, 'minh', a, 10);
    await seedTask(family, 'minh', b, 5);
    const page = await openChild(browser, family);

    await expect(page.getByText('Còn 2 việc hôm nay!', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /^Lúc nào cũng được, 2 việc/ })).toBeVisible();
    await page.getByRole('checkbox', { name: a }).click();
    await expect(page.getByText('Còn 1 việc hôm nay!', { exact: true })).toBeVisible();
    await page.getByRole('checkbox', { name: b }).click();

    await expect(page.getByText('Xong hết rồi!', { exact: true })).toBeVisible();
    await expect(page.getByText('Mục tiêu hôm nay hoàn thành', { exact: true })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: a })).toHaveCount(0); // la liste est repliée
    await expect(page.getByText('Còn 45 ⚡ nữa là đi được!', { exact: true })).toBeVisible(); // 10 + 5 points = 15 ⚡ sur 60
    await expect.poll(async () => (await serverState(family, 'minh', b)).completed).toBe(true);

    await page.getByRole('link', { name: 'Xem lại' }).click();
    await expect(page.getByRole('checkbox', { name: a })).toBeChecked();
    await expect(page.getByText('chờ bố mẹ duyệt', { exact: true }).first()).toBeVisible();
  });

  test('avec 60 ⚡ : départ depuis la carte, le panda marche dans le décor de la destination', async ({ browser }) => {
    test.setTimeout(120_000);
    const family = await createFamily({ uiVersion: 'v2' });
    await seedCompanion(family, 'minh', 'Bambou');
    await seedEnergy(family, 'minh', 60);
    const page = await openChild(browser, family);

    await expect(page.getByLabel('Phiêu lưu: 60 trên 60 năng lượng')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('v2-scene-home')).toBeAttached();
    await page.getByRole('button', { name: 'Đi phiêu lưu!' }).click();
    await expect(page).toHaveURL(/\/v2\/child\/adventure/);
    await expect(page.getByRole('button', { name: 'Phong Nha, mở ở cấp 6' })).toBeDisabled();
    await page.getByRole('button', { name: 'Vịnh Hạ Long' }).click();

    await expect(page).toHaveURL(/\/v2\/child\/home/, { timeout: 20_000 });
    await expect(page.getByTestId('v2-scene-ha-long')).toBeAttached({ timeout: 20_000 });
    await expect(page.getByLabel('Panda Bambou đang đi phiêu lưu').filter({ visible: true })).toBeVisible();
    // l'onglet Phiêu lưu, déjà ouvert, reste monté avec sa propre carte d'aventure : deux fois le même message
    await expect(page.getByText('Đang phiêu lưu · về sáng mai', { exact: true }).first()).toBeVisible();
    await expect.poll(async () => (await adventuresOf(family, 'minh')).adventures.length).toBe(1);
    expect((await adventuresOf(family, 'minh')).adventures[0]).toMatchObject({ destination_slug: 'ha-long', energy_mark: 60 });
  });
});

test.describe('interface V2 : parent (D-106)', () => {
  test('le parent valide depuis Hôm nay une tâche cochée par l\'enfant ; les points sont crédités une fois', async ({ browser }) => {
    test.setTimeout(120_000);
    const family = await createFamily({ uiVersion: 'v2' });
    const taskTitle = title('Tưới cây');
    const taskId = await seedTask(family, 'minh', taskTitle, 10);
    // l'enfant a coché (état « chờ duyệt ») : posé par le service local, comme le ferait complete_task
    const { error } = await serviceClient().from('tasks').update({ completed_at: new Date().toISOString(), completed_by: family.minh.memberId }).eq('id', taskId);
    if (error) throw new Error(error.message);

    const ctx = await browser.newContext();
    await signInContext(ctx, family.parent);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log(`[v2-parent] pageerror ${e.message.slice(0, 300)}`));
    await page.goto('/');
    await expect(page).toHaveURL(/\/v2\/parent\/home/, { timeout: 20_000 });
    await expect(page.getByText('Cần duyệt', { exact: true }).filter({ visible: true })).toBeVisible({ timeout: 20_000 });
    const card = page.getByTestId(`v2-approve-${taskId}`);
    await expect(card.getByText(taskTitle, { exact: true })).toBeVisible();
    await card.getByRole('button', { name: 'Duyệt', exact: true }).click();
    await expect.poll(async () => (await serverState(family, 'minh', taskTitle)).validated).toBe(true);
    expect(await serverState(family, 'minh', taskTitle)).toMatchObject({ balance: 10, transactions: 1 });
    await expect(card).toHaveCount(0);
  });
});

test.describe('interface V2 : vidéo d\'accueil (D-106)', () => {
  /** Khang a 13 ans : panda TEEN (stade 3), la seule vidéo fournie. */
  async function openTeen(browser: import('@playwright/test').Browser, family: Awaited<ReturnType<typeof createFamily>>, options: { reducedMotion?: 'reduce' } = {}) {
    const ctx = await browser.newContext(options);
    await signInContext(ctx, family.khang);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log(`[v2-video] pageerror ${e.message.slice(0, 300)}`));
    page.on('dialog', (d) => void d.accept());
    await page.goto('/');
    await expect(page).toHaveURL(/\/v2\/child\/home/, { timeout: 20_000 });
    return page;
  }

  test('stade 3 à la maison : la vidéo remplace le décor ; panda entier, centré, entre les boutons et la carte, à 375, 390, 430 et 768 px', async ({ browser }) => {
    test.setTimeout(150_000);
    const family = await createFamily({ uiVersion: 'v2' });
    await seedCompanion(family, 'khang', 'Bambou');
    const page = await openTeen(browser, family);
    const video = page.getByTestId('v2-home-video-element');
    await expect(video).toBeAttached({ timeout: 20_000 });
    expect(await video.evaluate((v: HTMLVideoElement) => ({ muted: v.muted, loop: v.loop, sources: [...v.querySelectorAll('source')].map((x) => x.type) }))).toEqual({ muted: true, loop: true, sources: ['video/webm', 'video/mp4'] });
    // le libellé du panda reste lisible (PandaSprite sous la vidéo), la vidéo est décorative
    await expect(page.getByLabel('Panda Bambou, bình tĩnh')).toBeAttached();
    expect(await video.getAttribute('aria-hidden')).toBe('true');

    for (const width of [375, 390, 430, 768]) {
      await page.setViewportSize({ width, height: 844 });
      const box = page.getByTestId('v2-home-video-box');
      await expect(box).toBeVisible();
      await page.waitForTimeout(300);
      const b = (await box.boundingBox())!;
      const top = b.y + Number(await box.getAttribute('data-panda-top'));
      const bottom = b.y + Number(await box.getAttribute('data-panda-bottom'));
      const buttons = (await page.getByTestId('v2-top-bell').boundingBox())!;
      const card = (await page.getByTestId('v2-adventure-filling').boundingBox())!;
      expect(top).toBeGreaterThanOrEqual(buttons.y + buttons.height); // pas coupé par les boutons du haut
      expect(bottom).toBeLessThanOrEqual(card.y + 2); // ni par la carte Phiêu lưu
      expect(Math.abs(b.x + b.width / 2 - width / 2)).toBeLessThanOrEqual(2); // centré
      await page.screenshot({ path: test.info().outputPath(`v2-video-${width}.png`) });
      await page.screenshot({ path: `test-results/v2-captures/v2-video-${width}.png` });
    }
  });

  test('pendant une aventure : décor de la destination, sans vidéo ; « réduire les animations » : jamais de vidéo', async ({ browser }) => {
    test.setTimeout(150_000);
    const family = await createFamily({ uiVersion: 'v2' });
    await seedCompanion(family, 'khang', 'Bambou');
    await seedEnergy(family, 'khang', 60);
    const reduced = await openTeen(browser, family, { reducedMotion: 'reduce' });
    await expect(reduced.getByTestId('v2-scene-home')).toBeAttached({ timeout: 20_000 });
    await expect(reduced.getByLabel('Phiêu lưu: 60 trên 60 năng lượng')).toBeVisible();
    await expect(reduced.getByTestId('v2-home-video-element')).toHaveCount(0);

    const page = await openTeen(browser, family);
    await expect(page.getByTestId('v2-home-video-element')).toBeAttached({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Đi phiêu lưu!' }).click();
    await page.getByRole('button', { name: 'Vịnh Hạ Long' }).click();
    await expect(page).toHaveURL(/\/v2\/child\/home/, { timeout: 20_000 });
    await expect(page.getByTestId('v2-scene-ha-long')).toBeAttached({ timeout: 20_000 });
    await expect(page.getByTestId('v2-home-video-element')).toHaveCount(0);
    await expect(page.getByLabel('Panda Bambou đang đi phiêu lưu').first()).toBeVisible();
  });
});
