import { readFileSync } from 'fs';
import { join } from 'path';

const html = readFileSync(join(__dirname, '../public/index.html'), 'utf8');

describe('gabarit PWA : barre d’état translucide de l’iPhone (D-106)', () => {
  it('la page passe sous la barre d’état', () => {
    expect(html).toContain('name="apple-mobile-web-app-status-bar-style" content="black-translucent"');
    expect(html).toContain('viewport-fit=cover');
  });
  it('PWA installée : hauteur complétée de la marge haute (sinon une bande vide de la hauteur de la barre d’état apparaît en bas)', () => {
    expect(html).toMatch(/@media \(display-mode: standalone\)\s*\{\s*html\s*\{\s*height: calc\(100% \+ env\(safe-area-inset-top\)\);/);
  });
});
