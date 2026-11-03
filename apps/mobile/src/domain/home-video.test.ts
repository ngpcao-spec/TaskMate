import { HOME_VIDEO, homeVideoLayout, homeVideoSize, homeVideoSources, showHomeVideo, videoShowsFrames } from './home-video';

const ok = { scene: 'home', adventure: 'filling' as const, hasStageVideo: true, variant: 'boy', reduceMotion: false, saveData: false, web: true };

describe('vidéo d’accueil : quand l’afficher (D-106)', () => {
  it('toutes les conditions réunies', () => expect(showHomeVideo(ok)).toBe(true));
  it('jauge pleine ou sans aventure : oui', () => {
    expect(showHomeVideo({ ...ok, adventure: 'ready_to_go' })).toBe(true);
    expect(showHomeVideo({ ...ok, adventure: null })).toBe(true);
  });
  it('trouvaille à ouvrir (retour) ou voyage : jamais, même sur le décor maison', () => {
    expect(showHomeVideo({ ...ok, adventure: 'back' })).toBe(false);
    expect(showHomeVideo({ ...ok, adventure: 'away' })).toBe(false);
  });
  it('décor d’aventure (en voyage) : jamais', () => {
    expect(showHomeVideo({ ...ok, scene: 'ha-long' })).toBe(false);
    expect(showHomeVideo({ ...ok, scene: 'phong-nha' })).toBe(false);
  });
  it('aucune vidéo pour le stade affiché (décalage compris : stades 1 et 2 aujourd’hui) : jamais', () => {
    expect(showHomeVideo({ ...ok, hasStageVideo: false })).toBe(false);
  });
  it('variante fille : jamais (pas encore de vidéo)', () => expect(showHomeVideo({ ...ok, variant: 'girl' })).toBe(false));
  it('variante absente (état mis en cache avant D-106) : garçon', () => expect(showHomeVideo({ ...ok, variant: undefined })).toBe(true));
  it('« réduire les animations » : jamais', () => expect(showHomeVideo({ ...ok, reduceMotion: true })).toBe(false));
  it('économie de données : jamais', () => expect(showHomeVideo({ ...ok, saveData: true })).toBe(false));
  it('natif (iOS, Android) : jamais', () => expect(showHomeVideo({ ...ok, web: false })).toBe(false));
});

describe('vidéo d’accueil : source et cadrage', () => {
  it('480 px sous 400 de large', () => {
    expect(homeVideoSize(375)).toBe('small');
    expect(homeVideoSize(399)).toBe('small');
    expect(homeVideoSize(400)).toBe('full');
    expect(homeVideoSize(768)).toBe('full');
  });
  it.each([375, 390, 430])('téléphone %i px : pleine largeur, pieds sur le sol, panda entier sous les boutons', (width) => {
    const l = homeVideoLayout({ width, height: 300, groundY: 276, topClear: 60 });
    expect(l.boxWidth).toBe(width);
    expect(l.boxLeft).toBe(0);
    expect(Math.abs(l.pandaBottom - 276)).toBeLessThanOrEqual(1);
    expect(l.pandaTop).toBeGreaterThanOrEqual(60);
    expect(l.objectPositionY).toBeGreaterThan(0);
    expect(l.objectPositionY).toBeLessThan(100);
  });
  it('tablette 768 px : boîte réduite et centrée pour garder le panda entier', () => {
    const l = homeVideoLayout({ width: 768, height: 300, groundY: 276, topClear: 60 });
    expect(l.boxWidth).toBeLessThan(768);
    expect(l.boxLeft).toBe(Math.round((768 - l.boxWidth) / 2));
    expect(l.pandaTop).toBeGreaterThanOrEqual(60);
    expect(Math.abs(l.pandaBottom - 276)).toBeLessThanOrEqual(1);
  });
  it('en-tête plus haut que la vidéo à l’échelle de la largeur : cover par la hauteur, centré', () => {
    const l = homeVideoLayout({ width: 120, height: 300, groundY: 276, topClear: 0 });
    expect(l.boxWidth).toBe(120);
    expect(l.objectPositionY).toBe(50);
  });
  it.each([375, 390, 430, 768])('aperçu fixe à %i px : même cadre que la vidéo (cover, sans déformation)', (width) => {
    const l = homeVideoLayout({ width, height: 300, groundY: 276, topClear: 60 });
    expect(l.image.width).toBeGreaterThanOrEqual(l.boxWidth);
    expect(l.image.height).toBeGreaterThanOrEqual(300);
    expect(Math.abs(l.image.width / l.image.height - 720 / 1280)).toBeLessThan(0.01);
    expect(l.image.left).toBe(Math.round((l.boxWidth - l.image.width) / 2));
    expect(l.image.top).toBeLessThanOrEqual(0);
    expect(l.image.top + l.image.height).toBeGreaterThanOrEqual(300);
    // pieds du panda (70,7 % de l'image) sur le sol
    expect(Math.abs(l.image.top + 0.707 * l.image.height - 276)).toBeLessThanOrEqual(1);
  });
});

describe('vidéo d’accueil : sources et poster (iPhone)', () => {
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
  const IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1';
  const MAC_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
  const MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
  it('Safari et navigateurs iOS : mp4 (H.264) d’abord', () => {
    for (const ua of [IPHONE, IPHONE_CHROME, MAC_SAFARI]) expect(homeVideoSources(ua, 430).map((s) => s.key)).toEqual(['mp4', 'webm']);
    expect(homeVideoSources(IPHONE, 375).map((s) => s.key)).toEqual(['mp4Small', 'webm']);
  });
  it('Chrome, Android : webm d’abord', () => {
    for (const ua of [MAC_CHROME, ANDROID]) expect(homeVideoSources(ua, 430).map((s) => s.type)).toEqual(['video/webm', 'video/mp4']);
  });
  it('poster effacé seulement quand une image est peinte', () => {
    expect(videoShowsFrames({ paused: true, currentTime: 0 })).toBe(false);
    expect(videoShowsFrames({ paused: false, currentTime: 0 })).toBe(false);
    expect(videoShowsFrames({ paused: false, currentTime: 0.04 })).toBe(true);
  });
});

describe('vidéo d’accueil : cadrage par vidéo (D-106, đồng hành)', () => {
  // géométrie mesurée sur l'aperçu (plan large) : panda un peu plus petit que le teen, pieds plus hauts (68,8 % contre 70,7 %)
  const DONG_HANH = { width: 720, height: 1280, headY: 0.485, feetY: 0.688 };
  // iPhone : barre d'état 47 pt, en-tête 300 + 47, sol à 24 pt du bas, boutons du haut 47 + 8 + 44 + 8
  const phone = (width: number) => ({ width, height: 347, groundY: 323, topClear: 107 });
  it.each([390, 430])('%i px : pieds sur la même ligne de sol que le teen, panda entier sous les boutons, centré', (width) => {
    const teen = homeVideoLayout(phone(width));
    const dh = homeVideoLayout(phone(width), DONG_HANH);
    expect(Math.abs(dh.pandaBottom - 323)).toBeLessThanOrEqual(1);
    expect(Math.abs(teen.pandaBottom - 323)).toBeLessThanOrEqual(1);
    expect(dh.pandaTop).toBeGreaterThanOrEqual(107);
    expect(dh.boxLeft).toBe(Math.round((width - dh.boxWidth) / 2));
    // plan large : pleine largeur sur téléphone, comme le teen
    expect(dh.boxWidth).toBe(width);
    expect(dh.pandaBottom - dh.pandaTop).toBeLessThanOrEqual(teen.pandaBottom - teen.pandaTop);
    // même ligne de sol mais pieds plus hauts dans l'image : l'object-position diffère (une valeur par vidéo, calculée)
    expect(dh.objectPositionY).not.toBe(teen.objectPositionY);
    expect(Math.abs(dh.image.top + DONG_HANH.feetY * dh.image.height - 323)).toBeLessThanOrEqual(1);
  });
  it('défaut = géométrie teen', () => {
    expect(homeVideoLayout(phone(390))).toEqual(homeVideoLayout(phone(390), HOME_VIDEO));
  });
});

describe('vidéo d’accueil : cadrage par vidéo (D-106, nhí)', () => {
  // géométrie mesurée sur toutes les images : la patte qui salue ne dépasse jamais la pousse ; pieds plus bas que le teen
  const NHI = { width: 720, height: 1280, headY: 0.485, feetY: 0.73 };
  const phone = (width: number) => ({ width, height: 347, groundY: 323, topClear: 107 });
  it.each([390, 430])('%i px : pleine largeur, pieds sur la ligne de sol, panda entier sous les boutons, object-position propre', (width) => {
    const teen = homeVideoLayout(phone(width));
    const l = homeVideoLayout(phone(width), NHI);
    expect(l.boxWidth).toBe(width);
    expect(l.boxLeft).toBe(0);
    expect(Math.abs(l.pandaBottom - 323)).toBeLessThanOrEqual(1);
    expect(l.pandaTop).toBeGreaterThanOrEqual(107);
    expect(l.objectPositionY).not.toBe(teen.objectPositionY);
    expect(Math.abs(l.image.top + NHI.feetY * l.image.height - 323)).toBeLessThanOrEqual(1);
  });
});
