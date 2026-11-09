import { expect, test, webkit, type Page } from '@playwright/test';
import { adventureNextDay, adventuresOf, createFamily, seedCompanion, seedEnergy, seedTask, serverState, serviceClient, signInContext } from './support/seed';
import vi from '../src/i18n/locales/vi.json';

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
    await expect(page.getByText('Hôm nay: 2/2 việc ✓', { exact: true })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: a })).toHaveCount(0); // la liste est repliée
    await expect(page.getByText('Còn 45 ⚡ nữa là đi được!', { exact: true })).toBeVisible(); // 10 + 5 points = 15 ⚡ sur 60
    await expect.poll(async () => (await serverState(family, 'minh', b)).completed).toBe(true);

    await page.getByRole('link', { name: 'Xem lại' }).click();
    await expect(page.getByRole('checkbox', { name: a })).toBeChecked();
    await expect(page.getByText('chờ bố mẹ duyệt', { exact: true }).first()).toBeVisible();
  });

  /** Captures 390 et 430 px (fichier + JPEG base64 dans le journal CI, l'artefact n'étant pas toujours téléchargeable). */
  async function capture(page: Page, tag: string) {
    for (const width of [390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `test-results/v2-captures/v2-trip-${tag.toLowerCase()}-${width}.png` });
      const jpeg = await page.screenshot({ type: 'jpeg', quality: 60 });
      console.log(`=====V2-CAPTURE-${tag}-${width}-BEGIN=====\n${jpeg.toString('base64')}\n=====V2-CAPTURE-${tag}-${width}-END=====`);
    }
  }

  test('le grand départ (D-107) : jauge pleine → carte → carte postale → « Lên đường! » → trajet, départ du panda → maison vide avec le mot ; le lendemain : entrée, paquet, trouvaille, carnet ; jamais de fenêtre système', async ({ browser }) => {
    test.setTimeout(180_000);
    const family = await createFamily({ uiVersion: 'v2' });
    await seedCompanion(family, 'minh', 'Bambou');
    await seedEnergy(family, 'minh', 60);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await signInContext(ctx, family.minh);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log(`[v2-voyage] pageerror ${e.message.slice(0, 300)}`));
    // espion : aucune fenêtre système (window.confirm, alert) ne doit s'ouvrir
    const dialogs: string[] = [];
    page.on('dialog', (d) => {
      dialogs.push(`${d.type()}: ${d.message()}`);
      void d.dismiss();
    });
    await page.goto('/');
    await expect(page).toHaveURL(/\/v2\/child\/home/, { timeout: 20_000 });

    // jauge pleine : le panda reste éveillé et le dit ; la carte d'aventure propose de choisir la destination
    await expect(page.getByLabel('Phiêu lưu: 60 trên 60 năng lượng')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Đi phiêu lưu thôi!', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Chọn nơi đến' }).click();
    await expect(page).toHaveURL(/\/v2\/child\/adventure/);
    await expect(page.getByLabel('Nhà của Bambou')).toBeVisible();

    // destination verrouillée : carte postale sans départ
    await page.getByRole('button', { name: 'Phong Nha, mở ở cấp 6' }).click();
    await expect(page.getByText('Cấp hiện tại: 1', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lên đường!' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Để sau' }).click();
    await expect(page.getByTestId('v2-postcard-phong-nha')).toHaveCount(0);

    // destination débloquée : carte postale, invitation, trouvailles en silhouettes
    await page.getByRole('button', { name: 'Vịnh Hạ Long' }).click();
    const sheet = page.getByTestId('v2-postcard-ha-long');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('Vịnh Hạ Long', { exact: true })).toBeVisible();
    await expect(sheet.getByText('0/6', { exact: true })).toBeVisible();
    await expect(sheet.getByLabel('Chưa tìm thấy')).toHaveCount(6);
    await capture(page, 'SHEET');
    await page.setViewportSize({ width: 390, height: 844 });
    await sheet.getByRole('button', { name: 'Lên đường!' }).click();

    // départ accepté : le trajet se trace sur la carte, puis Hôm nay : le panda s'en va, la maison reste vide avec le mot
    await expect(page.getByTestId('v2-trip-dot').first()).toBeAttached({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/v2\/child\/home/, { timeout: 20_000 });
    const note = page.getByTestId('v2-trip-note');
    await expect(note).toBeVisible({ timeout: 20_000 });
    await expect(note).toHaveAccessibleName(/^Tớ đi Vịnh Hạ Long, sáng mai về nhé! — Bambou$|Vịnh Hạ Long/);
    await expect(page.getByTestId('v2-scene-home').first()).toBeAttached();
    await expect(page.getByTestId('v2-panda')).toHaveCount(0);
    await expect(page.getByTestId('v2-home-video-element')).toHaveCount(0);
    await expect(page.getByText('Bambou đang ở Vịnh Hạ Long · về sáng mai', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Chuyến tiếp theo đang chờ!', { exact: true }).first()).toBeVisible();
    await expect.poll(async () => (await adventuresOf(family, 'minh')).adventures.length).toBe(1);
    expect((await adventuresOf(family, 'minh')).adventures[0]).toMatchObject({ destination_slug: 'ha-long', energy_mark: 60, discovery_slug: null });
    await capture(page, 'NOTE');
    await page.setViewportSize({ width: 390, height: 844 });
    // le mot rouvre la carte postale en lecture seule
    await note.click();
    await expect(page.getByTestId('v2-postcard-ha-long')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lên đường!' })).toHaveCount(0);
    await page.getByTestId('v2-postcard-close').click();

    // le lendemain (dates de l'aventure reculées d'un jour) : le panda rentre avec un paquet
    await adventureNextDay(family, 'minh');
    // nouvel appareil (cache vide) : l'état d'aventure persisté du précédent serait encore frais (moins de 30 s)
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await signInContext(ctx2, family.minh);
    const back = await ctx2.newPage();
    back.on('pageerror', (e) => console.log(`[v2-voyage] pageerror ${e.message.slice(0, 300)}`));
    back.on('dialog', (d) => {
      dialogs.push(`${d.type()}: ${d.message()}`);
      void d.dismiss();
    });
    await back.goto('/');
    await expect(back).toHaveURL(/\/v2\/child\/home/, { timeout: 20_000 });
    await expect(back.getByTestId('v2-trip-walk-in').or(back.getByTestId('v2-trip-gift-button'))).toBeAttached({ timeout: 20_000 });
    const gift = back.getByRole('button', { name: 'Mở quà' }).and(back.getByTestId('v2-trip-gift-button'));
    await expect(gift).toBeVisible({ timeout: 20_000 });
    await expect(back.getByText(/Có quà cho Minh|Quà này cho Minh|quà nhỏ cho Minh|dành cho Minh|Minh mở quà/).first()).toBeVisible();
    const box = (await gift.boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
    await gift.click();
    await expect(back.getByTestId('v2-trip-reveal')).toBeVisible({ timeout: 20_000 });
    await expect.poll(async () => (await adventuresOf(family, 'minh')).journal.length).toBe(1);
    const slug = (await adventuresOf(family, 'minh')).journal[0]!.discovery_slug as string;
    const name = (vi.adventure.discoveries as Record<string, string>)[slug]!;
    await expect(back.getByTestId('v2-trip-reveal').getByText(name, { exact: true })).toBeVisible();
    await capture(back, 'GIFT');
    await back.setViewportSize({ width: 390, height: 844 });
    await back.getByRole('button', { name: 'Cất vào sổ' }).click();
    await expect(back.getByTestId('v2-trip-reveal')).toHaveCount(0);
    // rouverte : la séquence ne se rejoue jamais, aucun nouveau tirage
    await back.reload();
    await expect(back.getByLabel(/^Phiêu lưu: \d+ trên 60 năng lượng$/)).toBeVisible({ timeout: 20_000 });
    await expect(back.getByTestId('v2-trip-gift-button')).toHaveCount(0);
    await expect(back.getByTestId('v2-trip-reveal')).toHaveCount(0);
    expect((await adventuresOf(family, 'minh')).journal).toEqual([{ discovery_slug: slug, times_found: 1 }]);
    expect(dialogs).toEqual([]);
  });

  test('vidéo de voyage, stade 1 (D-107) : départ → le panda bé marche dans la vidéo (plus de mot), cadré sur la ligne de sol à 390, 430 px et tablette ; toucher → carte postale ; retour inchangé', async ({ browser }) => {
    test.setTimeout(180_000);
    const family = await createFamily({ uiVersion: 'v2' });
    // stade 1 : Khang rajeuni à 4 ans par le service (aucun enfant de la famille de test n'a moins de 6 ans)
    const birth = new Date(Date.now() - 4 * 365.25 * 86_400_000).toISOString().slice(0, 10);
    const { error } = await serviceClient().from('children').update({ birth_date: birth }).eq('id', family.khang.childId as string);
    if (error) throw new Error(`children: ${error.message}`);
    await seedCompanion(family, 'khang', 'Bambou');
    await seedEnergy(family, 'khang', 60);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await signInContext(ctx, family.khang);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log(`[v2-voyage-be] pageerror ${e.message.slice(0, 300)}`));
    const dialogs: string[] = [];
    page.on('dialog', (d) => {
      dialogs.push(`${d.type()}: ${d.message()}`);
      void d.dismiss();
    });
    await page.goto('/');
    await expect(page).toHaveURL(/\/v2\/child\/home/, { timeout: 20_000 });
    await page.getByRole('button', { name: 'Chọn nơi đến' }).click();
    await page.getByRole('button', { name: 'Vịnh Hạ Long' }).click();
    await page.getByTestId('v2-postcard-ha-long').getByRole('button', { name: 'Lên đường!' }).click();
    await expect(page).toHaveURL(/\/v2\/child\/home/, { timeout: 20_000 });

    // après la sortie du panda : directement la vidéo de voyage, à la place de la maison vide et du mot
    const video = page.getByTestId('v2-trip-video-element');
    await expect(video).toBeAttached({ timeout: 20_000 });
    expect(await video.evaluate((v: HTMLVideoElement) => [v.muted, v.loop, v.playsInline, [...v.querySelectorAll('source')].map((x) => x.getAttribute('src') ?? '')])).toEqual([
      true,
      true,
      true,
      [expect.stringContaining('trip-be'), expect.stringContaining('trip-be')],
    ]);
    const box = page.getByTestId('v2-trip-video-box');
    await expect(box).toHaveAttribute('data-ready', 'true', { timeout: 20_000 });
    await expect(page.getByTestId('v2-trip-note')).toHaveCount(0);
    await expect(page.getByTestId('v2-home-video-element')).toHaveCount(0);
    await expect(page.getByText('Bambou đang ở Vịnh Hạ Long · về sáng mai', { exact: true }).first()).toBeVisible();

    for (const [width, height, tag] of [[390, 844, '390'], [430, 932, '430'], [820, 1180, 'tablet']] as const) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(400);
      const b = (await box.boundingBox())!;
      const top = b.y + Number(await box.getAttribute('data-panda-top'));
      const bottom = b.y + Number(await box.getAttribute('data-panda-bottom'));
      // l'onglet Phiêu lưu reste monté (caché) : on mesure les éléments VISIBLES de Hôm nay
      const buttons = (await page.getByTestId('v2-top-bell').filter({ visible: true }).first().boundingBox())!;
      const card = (await page.getByTestId('v2-adventure-away').filter({ visible: true }).first().boundingBox())!;
      expect(top).toBeGreaterThanOrEqual(buttons.y + buttons.height);
      // pieds sur la ligne de sol (comme les vidéos de la maison), jamais sous la carte Phiêu lưu
      expect(bottom).toBeLessThanOrEqual(card.y + 2);
      // ligne de sol des vidéos de la maison : 24 px au-dessus du bas de l'en-tête (SCENE_GROUND_OFFSET)
      expect(Math.abs(bottom - (b.y + b.height - 24))).toBeLessThanOrEqual(2);
      expect(Math.abs(b.x + b.width / 2 - width / 2)).toBeLessThanOrEqual(2);
      await page.screenshot({ path: `test-results/v2-captures/v2-trip-walk-${tag}.png` });
      const jpeg = await page.screenshot({ type: 'jpeg', quality: 60, clip: { x: 0, y: 0, width, height: 640 } });
      console.log(`=====V2-CAPTURE-WALK-${tag}-BEGIN=====\n${jpeg.toString('base64')}\n=====V2-CAPTURE-WALK-${tag}-END=====`);
    }
    await page.setViewportSize({ width: 390, height: 844 });

    // toucher le panda qui marche : la carte postale, en lecture seule
    await page.getByRole('button', { name: 'Bambou đang trên đường đến Vịnh Hạ Long' }).click();
    await expect(page.getByTestId('v2-postcard-ha-long')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lên đường!' })).toHaveCount(0);
    await page.getByTestId('v2-postcard-close').click();

    // le lendemain : séquence de retour D-107 (entrée + paquet), plus de vidéo de voyage
    await adventureNextDay(family, 'khang');
    const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await signInContext(ctx2, family.khang);
    const back = await ctx2.newPage();
    back.on('dialog', (d) => {
      dialogs.push(`${d.type()}: ${d.message()}`);
      void d.dismiss();
    });
    await back.goto('/');
    await expect(back).toHaveURL(/\/v2\/child\/home/, { timeout: 20_000 });
    await expect(back.getByRole('button', { name: 'Mở quà' }).and(back.getByTestId('v2-trip-gift-button'))).toBeVisible({ timeout: 20_000 });
    await expect(back.getByTestId('v2-trip-video-element')).toHaveCount(0);
    expect(dialogs).toEqual([]);
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
  /** Khang a 13 ans : panda TEEN (stade 3, NHÍ avec le décalage −1) ; Minh a 17 ans : panda ĐỒNG HÀNH (stade 4). */
  async function openTeen(
    browser: import('@playwright/test').Browser,
    family: Awaited<ReturnType<typeof createFamily>>,
    options: import('@playwright/test').BrowserContextOptions = {},
    who: 'khang' | 'minh' = 'khang',
  ) {
    const ctx = await browser.newContext(options);
    await signInContext(ctx, family[who]);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log(`[v2-video] pageerror ${e.message.slice(0, 300)}`));
    page.on('dialog', (d) => void d.accept());
    await page.goto('/');
    await expect(page).toHaveURL(/\/v2\/child\/home/, { timeout: 20_000 });
    return page;
  }

  test('Menu du haut : le bouton retour ramène à Hôm nay (la PWA n\'a pas de bouton retour du navigateur)', async ({ browser }) => {
    const family = await createFamily({ uiVersion: 'v2' });
    await seedCompanion(family, 'khang', 'Bambou');
    const page = await openTeen(browser, family);
    await page.getByTestId('v2-top-menu').click();
    await expect(page).toHaveURL(/\/v2\/menu/);
    await page.getByTestId('v2-back').click();
    await expect(page).toHaveURL(/\/v2\/child\/home/);
    // rouvert directement (aucun historique) : retour à l'accueil quand même
    await page.goto('/v2/menu');
    await page.getByTestId('v2-back').click();
    await expect(page).toHaveURL(/\/v2\/child\/home/, { timeout: 20_000 });
  });

  test('stade 3 à la maison : la vidéo remplace le décor ; panda entier, centré, entre les boutons et la carte, à 375, 390, 430 et 768 px', async ({ browser }) => {
    test.setTimeout(150_000);
    const family = await createFamily({ uiVersion: 'v2' });
    await seedCompanion(family, 'khang', 'Bambou');
    const page = await openTeen(browser, family);
    const video = page.getByTestId('v2-home-video-element');
    await expect(video).toBeAttached({ timeout: 20_000 });
    expect(await video.evaluate((v: HTMLVideoElement) => ({ muted: v.muted, loop: v.loop, sources: [...v.querySelectorAll('source')].map((x) => x.type) }))).toEqual({ muted: true, loop: true, sources: ['video/webm', 'video/mp4'] });
    // le libellé du panda reste lisible (PandaSprite sous la vidéo), la vidéo est décorative
    await expect(page.getByLabel(/^Panda Bambou, /)).toBeAttached(); // humeur selon l'heure locale (après 20 h : il dort)
    expect(await video.getAttribute('aria-hidden')).toBe('true');
    // l'aperçu fixe (Image React Native) remplace le décor ; la vidéo apparaît par-dessus dès qu'elle peint une image
    await expect(page.getByTestId('v2-home-video-poster')).toBeVisible();
    await expect(page.getByTestId('v2-home-video-box')).toHaveAttribute('data-ready', 'true', { timeout: 20_000 });

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
      // 375, 390 et 430 px : aussi dans le journal CI (JPEG compressé, base64) pour le rapport, l'artefact n'étant pas toujours téléchargeable
      if (width === 375 || width === 390 || width === 430) {
        const jpeg = await page.screenshot({ type: 'jpeg', quality: 60, clip: { x: 0, y: 0, width, height: 640 } });
        console.log(`=====V2-CAPTURE-${width}-BEGIN=====\n${jpeg.toString('base64')}\n=====V2-CAPTURE-${width}-END=====`);
      }
    }
  });

  // stade 4 : Minh (17 ans) ; stade 2 : Khang (13 ans, stade 3) avec le décalage −1 choisi par l'enfant (le stade AFFICHÉ choisit la vidéo) ; stade 1 : Khang à 4 ans
  for (const c of [
    { stage: 4, name: 'đồng hành', who: 'minh' as const, offset: 0 as const, key: 'home-dong-hanh', tag: 'DH', file: 'dong-hanh' },
    { stage: 2, name: 'nhí', who: 'khang' as const, offset: -1 as const, key: 'home-nhi', tag: 'NHI', file: 'nhi' },
    // stade 1 : Khang rajeuni à 4 ans par le service (aucun enfant de la famille de test n'a moins de 6 ans)
    { stage: 1, name: 'bé', who: 'khang' as const, offset: 0 as const, key: 'home-be', tag: 'BE', file: 'be', ageYears: 4 },
  ] as { stage: number; name: string; who: 'minh' | 'khang'; offset: -1 | 0; key: string; tag: string; file: string; ageYears?: number }[]) {
    test(`stade ${c.stage} (${c.name}) à la maison : SA vidéo, panda entier, pieds sur la ligne de sol, centré, à 390 et 430 px`, async ({ browser }) => {
      test.setTimeout(150_000);
      const family = await createFamily({ uiVersion: 'v2' });
      if (c.ageYears !== undefined) {
        const birth = new Date(Date.now() - c.ageYears * 365.25 * 86_400_000).toISOString().slice(0, 10);
        const { error } = await serviceClient().from('children').update({ birth_date: birth }).eq('id', family[c.who].childId as string);
        if (error) throw new Error(`children: ${error.message}`);
      }
      await seedCompanion(family, c.who, 'Bambou', 'kind', c.offset);
      const page = await openTeen(browser, family, {}, c.who);
      const video = page.getByTestId('v2-home-video-element');
      await expect(video).toBeAttached({ timeout: 20_000 });
      expect(await video.evaluate((v: HTMLVideoElement) => [...v.querySelectorAll('source')].map((x) => x.getAttribute('src') ?? ''))).toEqual([
        expect.stringContaining(c.key),
        expect.stringContaining(c.key),
      ]);
      await expect(page.getByTestId('v2-home-video-box')).toHaveAttribute('data-ready', 'true', { timeout: 20_000 });
      for (const width of [390, 430]) {
        await page.setViewportSize({ width, height: 844 });
        const box = page.getByTestId('v2-home-video-box');
        await expect(box).toBeVisible();
        await page.waitForTimeout(300);
        const b = (await box.boundingBox())!;
        const top = b.y + Number(await box.getAttribute('data-panda-top'));
        const bottom = b.y + Number(await box.getAttribute('data-panda-bottom'));
        const buttons = (await page.getByTestId('v2-top-bell').boundingBox())!;
        const card = (await page.getByTestId('v2-adventure-filling').boundingBox())!;
        expect(top).toBeGreaterThanOrEqual(buttons.y + buttons.height);
        expect(bottom).toBeLessThanOrEqual(card.y + 2);
        expect(Math.abs(b.x + b.width / 2 - width / 2)).toBeLessThanOrEqual(2);
        await page.screenshot({ path: `test-results/v2-captures/v2-video-${c.file}-${width}.png` });
        const jpeg = await page.screenshot({ type: 'jpeg', quality: 60, clip: { x: 0, y: 0, width, height: 640 } });
        console.log(`=====V2-CAPTURE-${c.tag}-${width}-BEGIN=====\n${jpeg.toString('base64')}\n=====V2-CAPTURE-${c.tag}-${width}-END=====`);
      }
    });
  }

  // Panda vidéo du stade 1 (D-106) : réactions jouées par le même lecteur ; la fin des vidéos est SIMULÉE par un événement `ended`
  // (le gestionnaire n'utilise aucun minuteur pour la fin), ce qui garde le test court et indépendant de la durée des fichiers.
  async function openBe(browser: import('@playwright/test').Browser, tasks: string[], blocked?: RegExp) {
    const family = await createFamily({ uiVersion: 'v2' });
    const birth = new Date(Date.now() - 4 * 365.25 * 86_400_000).toISOString().slice(0, 10);
    const { error } = await serviceClient().from('children').update({ birth_date: birth }).eq('id', family.khang.childId as string);
    if (error) throw new Error(`children: ${error.message}`);
    await seedCompanion(family, 'khang', 'Bambou');
    for (const t of tasks) await seedTask(family, 'khang', t, 10);
    const ctx = await browser.newContext();
    // fichier rendu indisponible AVANT l'ouverture (même la préparation légère échoue)
    if (blocked) await ctx.route(blocked, (r) => r.abort());
    await signInContext(ctx, family.khang);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log(`[v2-panda] pageerror ${e.message.slice(0, 300)}`));
    page.on('dialog', (d) => void d.accept());
    await page.goto('/');
    await expect(page).toHaveURL(/\/v2\/child\/home/, { timeout: 20_000 });
    await expect(page.getByTestId('v2-home-video-box')).toHaveAttribute('data-anim', 'idle', { timeout: 20_000 });
    return { family, page };
  }
  const box = (page: import('@playwright/test').Page) => page.getByTestId('v2-home-video-box');
  /** fin réelle simulée : l'événement `ended` de la vidéo de la réaction en cours */
  async function endReaction(page: import('@playwright/test').Page, anim: 'happy' | 'curious' | 'sleep') {
    await expect(box(page)).toHaveAttribute('data-anim', anim, { timeout: 10_000 });
    await page.locator(`video[data-anim="${anim}"]`).evaluate((v: HTMLVideoElement) => v.dispatchEvent(new Event('ended')));
  }

  test('panda vidéo stade 1 : repos, « content » à la coche, « curieux » au toucher, toucher ignoré pendant « content », une seule animation par tâche, arrière-plan', async ({ browser }) => {
    test.setTimeout(150_000);
    const a = 'Đánh răng bé';
    const b = 'Tưới cây bé';
    const { page } = await openBe(browser, [a, b]);
    // 1. repos en boucle
    expect(await page.locator('video[data-anim="idle"]').evaluate((v: HTMLVideoElement) => v.loop && v.muted)).toBe(true);
    // 3. toucher → curieux → repos
    const touch = page.getByRole('button', { name: 'Chạm vào Bambou' });
    const hit = (await touch.boundingBox())!;
    expect(hit.width).toBeGreaterThanOrEqual(44);
    expect(hit.height).toBeGreaterThanOrEqual(44);
    const bell = (await page.getByTestId('v2-top-bell').boundingBox())!;
    expect(hit.y).toBeGreaterThanOrEqual(bell.y + bell.height); // ne recouvre pas les boutons du haut
    await touch.click();
    await endReaction(page, 'curious');
    await expect(box(page)).toHaveAttribute('data-anim', 'idle', { timeout: 10_000 });
    // 2. coche → content (la coche passe tout de suite)
    await page.getByRole('checkbox', { name: a }).click();
    await expect(page.getByRole('checkbox', { name: a })).toBeChecked();
    await expect(box(page)).toHaveAttribute('data-anim', 'happy', { timeout: 10_000 });
    // 4. toucher pendant content : content continue
    await touch.click({ force: true });
    await page.waitForTimeout(400);
    await expect(box(page)).toHaveAttribute('data-anim', 'happy');
    expect(await page.locator('video[data-anim="curious"]').count()).toBe(0);
    // 6. arrière-plan puis retour : pause puis reprise, l'image reste
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(() => page.locator('video[data-anim="happy"]').evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(box(page)).toHaveCSS('opacity', '1');
    await endReaction(page, 'happy');
    await expect(box(page)).toHaveAttribute('data-anim', 'idle', { timeout: 10_000 });
    // 8. même tâche décochée puis recochée le même jour : une seule animation
    await page.getByRole('checkbox', { name: a }).click();
    await expect(page.getByRole('checkbox', { name: a })).not.toBeChecked();
    await page.getByRole('checkbox', { name: a }).click();
    await expect(page.getByRole('checkbox', { name: a })).toBeChecked();
    await page.waitForTimeout(600);
    await expect(box(page)).toHaveAttribute('data-anim', 'idle');
    expect(await page.locator('video[data-anim="happy"]').count()).toBe(0);
  });

  test('panda vidéo stade 1 : dernière tâche cochée → content, transition, puis sommeil en boucle qui reste (même après rechargement) ; vidéo indisponible → repos', async ({ browser }) => {
    test.setTimeout(150_000);
    const a = 'Đọc sách bé';
    const { page } = await openBe(browser, [a], /be-curious/);
    // 7. vidéo indisponible : la réaction est abandonnée (au plus 1,5 s), le panda reste au repos, jamais d'écran noir
    await page.getByRole('button', { name: 'Chạm vào Bambou' }).click();
    await page.waitForTimeout(2000);
    await expect(box(page)).toHaveAttribute('data-anim', 'idle');
    await expect(box(page)).toHaveCSS('opacity', '1');
    expect(await page.locator('video[data-anim="curious"]').count()).toBe(0);
    // 5. dernière tâche → content, puis la transition (il se couche et s'endort), puis il RESTE endormi : sommeil en boucle
    await page.getByRole('checkbox', { name: a }).click();
    await endReaction(page, 'happy');
    await expect(box(page)).toHaveAttribute('data-clip', 'be-fall-asleep', { timeout: 10_000 });
    await page.locator('video[data-clip="be-fall-asleep"]').evaluate((v: HTMLVideoElement) => v.dispatchEvent(new Event('ended')));
    await expect(box(page)).toHaveAttribute('data-clip', 'be-sleep', { timeout: 10_000 });
    expect(await page.locator('video[data-clip="be-sleep"]').evaluate((v: HTMLVideoElement) => v.loop)).toBe(true);
    await page.waitForTimeout(1000);
    await expect(box(page)).toHaveAttribute('data-clip', 'be-sleep'); // aucun retour automatique au repos
    // même jour, nouvel affichage : directement endormi (boucle), sans rejouer la transition
    await page.reload();
    await expect(box(page)).toHaveAttribute('data-clip', 'be-sleep', { timeout: 20_000 });
    expect(await page.locator('video[data-clip="be-fall-asleep"]').count()).toBe(0);
    const jpeg = await page.screenshot({ type: 'jpeg', quality: 60, clip: { x: 0, y: 0, width: page.viewportSize()!.width, height: 640 } });
    console.log(`=====V2-CAPTURE-BE-SLEEP-BEGIN=====\n${jpeg.toString('base64')}\n=====V2-CAPTURE-BE-SLEEP-END=====`);
  });

  // Une vidéo qui ne joue jamais (économie d'énergie de l'iPhone) ne s'émule pas : WebKit Linux lit les médias hors de l'interception réseau de
  // Playwright. Ce test vérifie que l'aperçu fixe (Image React Native) couvre le décor sous WebKit ; la vidéo invisible tant qu'aucune image n'est
  // peinte est vérifiée par __tests__/v2-home-video.test.tsx.
  test('WebKit iPhone : l\'aperçu fixe (Image) remplace le décor dès l\'ouverture, panda dessiné masqué, jamais un fond uni', async () => {
    test.setTimeout(150_000);
    const family = await createFamily({ uiVersion: 'v2' });
    await seedCompanion(family, 'khang', 'Bambou');
    const wk = await webkit.launch();
    try {
      const page = await openTeen(wk, family, {
        viewport: { width: 390, height: 844 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
      });
      await expect(page.getByTestId('v2-home-video-element')).toBeAttached({ timeout: 20_000 });
      const poster = page.getByTestId('v2-home-video-poster');
      await expect(poster).toBeVisible();
      await expect.poll(() => poster.locator('img').first().evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), { timeout: 20_000 }).toBe(true);
      await expect(page.getByTestId('v2-scene-backdrop')).toHaveCSS('opacity', '1');
      await expect(page.getByTestId('v2-scene-ground')).toHaveCSS('opacity', '0'); // pas de deuxième panda par-dessus l'aperçu
      await page.waitForTimeout(500);
      const jpeg = await page.screenshot({ type: 'jpeg', quality: 60, clip: { x: 0, y: 0, width: 390, height: 640 } });
      console.log(`=====V2-CAPTURE-WEBKIT-390-BEGIN=====\n${jpeg.toString('base64')}\n=====V2-CAPTURE-WEBKIT-390-END=====`);
    } finally {
      await wk.close();
    }
  });

  test('pendant une aventure (D-107) : maison vide, sans vidéo ni panda ; « réduire les animations » : jamais de vidéo, départ direct', async ({ browser }) => {
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
    await page.getByRole('button', { name: 'Chọn nơi đến' }).click();
    await page.getByRole('button', { name: 'Vịnh Hạ Long' }).click();
    await page.getByTestId('v2-postcard-go').click();
    await expect(page).toHaveURL(/\/v2\/child\/home/, { timeout: 20_000 });
    await expect(page.getByTestId('v2-trip-note')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('v2-scene-home').first()).toBeAttached();
    await expect(page.getByTestId('v2-home-video-element')).toHaveCount(0);
    await expect(page.getByTestId('v2-panda')).toHaveCount(0);
  });
});
