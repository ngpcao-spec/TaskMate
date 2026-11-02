import { homeVideoLayout, homeVideoSize, homeVideoSources, showHomeVideo, videoShowsFrames } from './home-video';

const ok = { scene: 'home', adventure: 'filling' as const, stage: 3, variant: 'boy', reduceMotion: false, saveData: false, web: true };

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
  it('stade affiché autre que teen (décalage compris) : jamais', () => {
    for (const stage of [1, 2, 4]) expect(showHomeVideo({ ...ok, stage })).toBe(false);
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
