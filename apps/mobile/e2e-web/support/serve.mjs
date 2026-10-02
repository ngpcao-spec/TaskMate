// Serveur statique minimal pour `dist` (export web), avec la même logique que Vercel :
// fichier existant sinon réécriture SPA vers index.html ; service worker jamais mis en cache.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = path.resolve(process.env.E2E_DIST ?? 'dist');
const port = Number(process.env.E2E_PORT ?? 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
};

http
  .createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(root, pathname);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
    const headers = { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' };
    if (pathname === '/sw.js' || pathname === '/sw-push.js') headers['Cache-Control'] = 'no-cache';
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`dist servi sur http://localhost:${port}`));
