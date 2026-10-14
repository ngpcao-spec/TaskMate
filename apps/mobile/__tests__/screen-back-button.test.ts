import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..');
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : /\.tsx$/.test(e.name) ? [path.join(dir, e.name)] : []));

describe('navigation : chaque écran secondaire a son bouton retour', () => {
  // Les écrans d'accueil de la connexion (onboarding) n'ont pas de « page précédente » : ils gardent un simple titre.
  const files = [...walk(path.join(root, 'app')), ...walk(path.join(root, 'src/components'))].filter((f) => !f.includes(`${path.sep}onboarding${path.sep}`) && !f.endsWith(`${path.sep}ui.tsx`));

  it('aucun écran secondaire n’affiche un simple <Title> : il utilise <ScreenHeader> (flèche retour + titre)', () => {
    const offenders = files.filter((f) => /<Title>/.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(root, f));
    expect(offenders).toEqual([]);
  });
});
