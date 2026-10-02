import { expect, test } from '@playwright/test';

test.describe('PWA', () => {
  test('manifest installable, icônes, métadonnées iOS', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();
    const manifest = await (await request.get(new URL(href as string, page.url()).href)).json();
    expect(manifest).toMatchObject({ name: 'TaskMate', display: 'standalone', start_url: '/', lang: 'vi' });
    const sizes = manifest.icons.map((i: { sizes: string; purpose?: string }) => `${i.sizes}:${i.purpose ?? 'any'}`);
    expect(sizes).toEqual(expect.arrayContaining(['192x192:any', '512x512:any', '512x512:maskable']));
    for (const icon of manifest.icons) expect((await request.get(new URL(icon.src, page.url()).href)).ok()).toBe(true);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveCount(1);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#1E88F5');
  });

  test('le service worker met l\'app en cache : démarrage hors ligne', async ({ page, context }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Bắt đầu' })).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload(); // la page est maintenant contrôlée : ses fichiers hachés passent par le cache
    await expect(page.getByRole('button', { name: 'Bắt đầu' })).toBeVisible();
    await expect.poll(() => page.evaluate(async () => (await caches.keys()).length)).toBeGreaterThan(0);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Bắt đầu' })).toBeVisible();
  });
});
