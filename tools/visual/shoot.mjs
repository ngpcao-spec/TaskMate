// Usage : node shoot.mjs <dossier-sortie> [parent|child]
// Variables : DIST (dossier exporté), VIEWPORT (ex. 1280x800).
// Prérequis : `node mock-server.mjs` lancé ; app exportée en web (voir README.md) dans ../../apps/mobile/dist-web.
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ids } from './fixtures.mjs';

const out = process.argv[2] ?? '../../docs/screenshots/after';
const role = process.argv[3] ?? 'parent';
const root = path.resolve(process.env.DIST ?? '../../apps/mobile/dist-web');
const [vw, vh] = (process.env.VIEWPORT ?? '390x844').split('x').map(Number);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] ?? 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(8081);

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const userId = role === 'child' ? ids.minhUser : ids.parent;
const now = Math.floor(Date.now() / 1000);
const session = {
  access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: userId, role: 'authenticated', exp: now + 36000, aud: 'authenticated' })}.sig`,
  token_type: 'bearer', expires_in: 36000, expires_at: now + 36000, refresh_token: 'r',
  user: { id: userId, aud: 'authenticated', role: 'authenticated', email: 'x@y.z', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
};

const screens = [
  ['01-splash', '/onboarding/role', false, async (page) => {}],
  ['02-accueil', '/', true],
  ['03-calendrier', '/calendar', true],
  ['04-ajout-tache', '/task/new', true],
  ['05-profil', '/more', true],
  ['06-objectifs', '/more/goals', true],
  ['07-points', '/more/points', true],
  ['08-stats', '/stats', true],
  ['09-file-a-approuver', '/approvals', true],
  ['10-reglages', '/more/settings', true],
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--no-sandbox'] });
fs.mkdirSync(out, { recursive: true });
for (const [name, route, authed] of screens) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: vw < 900 ? 2 : 1, isMobile: vw < 900, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' });
  if (authed) await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), ['sb-127-auth-token', JSON.stringify(session)]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[${name}] pageerror:`, e.message.slice(0, 200)));
  await page.goto(`http://localhost:8081${authed ? '/' : route}`, { waitUntil: 'networkidle' });
  if (authed && route !== '/') {
    await page.waitForTimeout(1200);
    await page.evaluate((r) => { history.pushState({}, '', r); dispatchEvent(new PopStateEvent('popstate')); }, route);
  }
  await page.waitForTimeout(1800);
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  console.log('shot', name);
  await ctx.close();
}
await browser.close();
server.close();
