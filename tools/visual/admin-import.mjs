// Usage : node admin-import.mjs <fichier.pdf|docx> <dossier-sortie>   (mock-server.mjs lancé ; app exportée dans ../../apps/mobile/dist-web)
// Vérifie dans un vrai Chromium le parcours « un seul fichier » de l'administrateur : choix du fichier → lecture (pdf.js dans le navigateur) → bilan → brouillons → publication.
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ids } from './fixtures.mjs';

const file = path.resolve(process.argv[2]);
const out = path.resolve(process.argv[3] ?? '../../docs/screenshots/after');
const root = path.resolve('../../apps/mobile/dist-web');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] ?? 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(8082);

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const session = {
  access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: ids.parent, role: 'authenticated', exp: now + 36000, aud: 'authenticated' })}.sig`,
  token_type: 'bearer', expires_in: 36000, expires_at: now + 36000, refresh_token: 'r',
  user: { id: ids.parent, aud: 'authenticated', role: 'authenticated', email: 'x@y.z', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
};
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), ['sb-127-auth-token', JSON.stringify(session)]);
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('console.error:', m.text().slice(0, 300)); });
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 300)));
const calls = [];
page.on('request', (r) => { if (r.method() === 'POST' && /rpc\/(create_catalog_draft|catalog_set_status)/.test(r.url())) calls.push({ url: r.url().split('/rpc/')[1], body: r.postDataJSON() }); });
fs.mkdirSync(out, { recursive: true });
await page.goto('http://localhost:8082/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.evaluate(() => { history.pushState({}, '', '/admin/import'); dispatchEvent(new PopStateEvent('popstate')); });
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(out, 'admin-import-1-choix.png') });
const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Chọn tệp' }).click()]);
await chooser.setFiles(file);
await page.getByText(/Tìm thấy \d+ bài/).waitFor({ timeout: 20000 }).catch(async (e) => {
  console.log('PAGE TEXT:', (await page.locator('body').innerText()).slice(0, 800));
  await page.screenshot({ path: path.join(out, 'admin-import-echec.png') });
  throw e;
});
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(out, 'admin-import-2-bilan.png') });
console.log('bilan :', await page.getByText(/Tìm thấy \d+ bài/).textContent());
await page.getByRole('button', { name: /Lưu \d+ bản nháp/ }).click();
await page.getByText(/đã tạo/).waitFor({ timeout: 10000 });
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(out, 'admin-import-3-brouillons.png') });
await page.getByRole('button', { name: /Xuất bản tất cả/ }).click();
await page.getByText('Đã xuất bản').first().waitFor({ timeout: 10000 });
await page.screenshot({ path: path.join(out, 'admin-import-4-publie.png') });
console.log(JSON.stringify(calls.map((c) => [c.url, c.body.p_grade ?? c.body.p_status, c.body.p_country, c.body.p_subject, c.body.p_week, c.body.p_release, c.body.p_due, c.body.p_questions?.length])));
await browser.close();
server.close();
