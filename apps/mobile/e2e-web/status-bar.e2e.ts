import { expect, test, type Browser, type Page } from '@playwright/test';
import { createFamily, seedCompanion, serviceClient, signInContext, todayVn, type Person } from './support/seed';

/**
 * Barre d'état translucide de la PWA iPhone (D-106) : la page passe sous l'heure et la batterie. Émulation par Chromium (marge haute forcée par CDP,
 * `env(safe-area-inset-top)`) : rien d'autre que le décor et la vidéo V2 ne doit se trouver sous la barre d'état, dans la V1 comme dans la V2.
 */
test.skip(({ browserName }) => browserName !== 'chromium', 'marge haute émulée par le protocole Chromium');

const PHONES = [
  { width: 390, height: 844, top: 47 },
  { width: 430, height: 932, top: 59 },
] as const;

async function openAs(browser: Browser, person: Person, phone: (typeof PHONES)[number], path = '/'): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: phone.width, height: phone.height }, deviceScaleFactor: 2, hasTouch: true });
  await signInContext(ctx, person);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[barre-etat] pageerror ${e.message.slice(0, 300)}`));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride' as never, { insets: { top: phone.top, bottom: 34, left: 0, right: 0 } } as never);
  await page.goto(path);
  return page;
}

/** Textes et contrôles visibles qui empiètent sur la barre d'état (le voile, le décor, la vidéo et tout ce qui est `aria-hidden` sont exclus). */
async function underStatusBar(page: Page, top: number): Promise<string[]> {
  return page.evaluate((limit) => {
    const bad: string[] = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      if (el.closest('[aria-hidden="true"]')) continue;
      const vis = (el as Element & { checkVisibility?: (o: object) => boolean }).checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) ?? true;
      if (!vis) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.bottom <= 0 || r.top >= limit - 0.5) continue;
      const text = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '');
      const control = el.matches('button, a, input, textarea, [role="button"], [role="checkbox"], [role="tab"], [role="radio"], [role="link"]');
      if (text || control) bad.push(`${el.tagName.toLowerCase()} « ${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)} » y=${Math.round(r.top)}`);
    }
    return bad;
  }, top);
}

async function check(page: Page, name: string, phone: (typeof PHONES)[number]) {
  await page.waitForTimeout(600);
  await expect(page.getByTestId('status-bar-scrim')).toBeAttached();
  expect(await underStatusBar(page, phone.top), `${name} ${phone.width} px : rien sous la barre d'état`).toEqual([]);
  await page.screenshot({ path: `test-results/v2-captures/barre-etat-${name}-${phone.width}.png` });
  if (phone.width === 390) {
    const jpeg = await page.screenshot({ type: 'jpeg', quality: 50 });
    console.log(`=====BARRE-ETAT-${name}-BEGIN=====\n${jpeg.toString('base64')}\n=====BARRE-ETAT-${name}-END=====`);
  }
}

for (const phone of PHONES) {
  test(`${phone.width}×${phone.height}, marge haute ${phone.top} : V2 enfant (vidéo, voyage), V2 parent, V1 Hôm nay et Cài đặt`, async ({ browser }) => {
    test.setTimeout(180_000);
    const v2 = await createFamily({ uiVersion: 'v2' });
    await seedCompanion(v2, 'khang', 'Bambou'); // 13 ans : panda teen, vidéo d'accueil

    // V2 enfant à la maison : la vidéo passe sous la barre d'état, les boutons restent dessous
    const child = await openAs(browser, v2.khang, phone);
    await expect(child).toHaveURL(/\/v2\/child\/home/, { timeout: 20_000 });
    await expect(child.getByTestId('v2-home-video-element')).toBeAttached({ timeout: 20_000 });
    const hdr = (await child.getByTestId('v2-scene-home').boundingBox())!;
    expect(hdr.y).toBeLessThanOrEqual(0.5); // le décor commence en haut de l'écran
    expect((await child.getByTestId('v2-top-bell').boundingBox())!.y).toBeGreaterThanOrEqual(phone.top);
    const box = child.getByTestId('v2-home-video-box');
    const b = (await box.boundingBox())!;
    expect(b.y).toBeLessThanOrEqual(0.5);
    expect(b.y + Number(await box.getAttribute('data-panda-top'))).toBeGreaterThanOrEqual(phone.top + 52); // oreilles sous les boutons
    await check(child, 'v2-enfant-video', phone);

    // V2 enfant en voyage : décor de la destination, sans vidéo
    const today = todayVn();
    const back = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
    const { error } = await serviceClient().from('child_adventures').insert({ id: crypto.randomUUID(), child_id: v2.khang.childId as string, family_id: v2.familyId, destination_slug: 'hoi-an', departed_on: today, returns_on: back, energy_mark: 0 });
    if (error) throw new Error(error.message);
    await child.reload();
    await expect(child.getByTestId('v2-scene-hoi-an')).toBeAttached({ timeout: 20_000 });
    await expect(child.getByTestId('v2-home-video-element')).toHaveCount(0);
    expect((await child.getByTestId('v2-scene-hoi-an').boundingBox())!.y).toBeLessThanOrEqual(0.5);
    await check(child, 'v2-enfant-voyage', phone);

    // V2 parent
    const parent = await openAs(browser, v2.parent, phone);
    await expect(parent).toHaveURL(/\/v2\/parent\/home/, { timeout: 20_000 });
    await expect(parent.getByText('Cần duyệt', { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await check(parent, 'v2-parent', phone);

    // V1 (interface par défaut) : Hôm nay et Cài đặt
    const v1 = await createFamily();
    const home = await openAs(browser, v1.parent, phone);
    await expect(home.getByText('Chào Minh!')).toBeVisible({ timeout: 20_000 });
    await check(home, 'v1-hom-nay', phone);
    const settings = await openAs(browser, v1.parent, phone, '/more/settings');
    await expect(settings.getByRole('heading').first()).toBeVisible({ timeout: 20_000 });
    await check(settings, 'v1-cai-dat', phone);
  });
}
