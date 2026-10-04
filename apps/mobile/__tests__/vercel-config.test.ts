import fs from 'node:fs';
import path from 'node:path';

type Header = { source: string; headers: { key: string; value: string }[] };
const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../vercel.json'), 'utf8')) as {
  installCommand: string;
  buildCommand: string;
  outputDirectory: string;
  rewrites: { source: string; destination: string }[];
  headers: Header[];
};
const cache = (source: string) => config.headers.find((h) => h.source === source)?.headers.find((h) => h.key === 'Cache-Control')?.value;

describe('vercel.json (monorepo)', () => {
  it('installe depuis la racine du workspace et construit apps/mobile en export web', () => {
    expect(config.installCommand).toBe('pnpm install --frozen-lockfile');
    expect(config.buildCommand).toContain('--filter @taskmate/mobile');
    expect(config.buildCommand).toContain('expo export --platform web');
    expect(config.outputDirectory).toBe('apps/mobile/dist');
    expect(fs.existsSync(path.resolve(__dirname, '../../../pnpm-workspace.yaml'))).toBe(true);
  });
  it('réécrit toutes les routes vers index.html (liens profonds, rechargement d\'une page)', () => {
    expect(config.rewrites).toContainEqual({ source: '/(.*)', destination: '/index.html' });
  });
  it('service worker et coquille sans cache, fichiers hachés en cache long', () => {
    expect(cache('/sw.js')).toContain('max-age=0');
    expect(cache('/sw-push.js')).toContain('max-age=0');
    expect(cache('/index.html')).toContain('must-revalidate');
    expect(cache('/manifest.webmanifest')).toContain('max-age=0');
    expect(cache('/_expo/static/(.*)')).toContain('immutable');
    expect(cache('/assets/(.*)')).toContain('immutable');
  });
  it('n\'autorise ni caméra ni micro (plus de scan QR) et jamais de secret dans le fichier', () => {
    const all = JSON.stringify(config);
    expect(all).toContain('camera=()');
    expect(all).not.toContain('camera=(self)');
    expect(all).not.toMatch(/service_role|secret|eyJ/i);
  });
});
