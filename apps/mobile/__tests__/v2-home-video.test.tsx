import { act, render, screen } from '@testing-library/react-native';
import { HomeVideo } from '@/v2/components/HomeVideo.web';
import { HomeVideo as NativeHomeVideo } from '@/v2/components/HomeVideo';
import { HomePoster } from '@/v2/components/HomePoster';
import { homeVideoLayout } from '@/domain/home-video';

jest.mock('expo-asset', () => ({ Asset: { fromModule: (m: unknown) => ({ uri: `asset:${String(m)}` }) } }));
// chaque fichier vidéo devient un nom lisible (les `require` du module `src/v2/video.ts`)
const mockEntry = (key: string, feetY: number, headY: number, maxFill?: number) => ({
  key,
  sources: { webm: `${key}.webm`, mp4: `${key}.mp4`, mp4Small: `${key}@480`, poster: `${key}-poster` },
  geometry: { width: 720, height: 1280, headY, feetY, maxFill },
});
const TEEN = mockEntry('home-teen', 0.707, 0.485);
const DONG_HANH = mockEntry('home-dong-hanh', 0.736, 0.438, 0.74);

type Node = { type: string; props: Record<string, unknown>; children: unknown[]; queryAll: (p: (n: Node) => boolean) => Node[] };
const listeners: Record<string, () => void> = {};
const fakeDocument = { hidden: false, addEventListener: (n: string, f: () => void) => (listeners[n] = f), removeEventListener: (n: string) => delete listeners[n] };
const mockSync = jest.fn();
jest.mock('@/v2/videoPlayback', () => ({ syncPlayback: (_el: unknown, playing: boolean) => mockSync(playing) }));

/** Les éléments DOM (`video`, `img`, `source`) rendus par le composant web, trouvés par type (ils sont décoratifs, donc cachés aux requêtes RNTL). */
const all = (container: Node, type: string) => container.queryAll((n) => n.type === type);
const layer = (container: Node) => container.queryAll((n) => n.props.testID === 'v2-home-video')[0]!;

const base = { video: TEEN, topClear: 60, groundOffset: 24, height: 347 };
async function show(props: Partial<Parameters<typeof HomeVideo>[0]> = {}, width = 390) {
  const r = await render(<HomeVideo visible active {...base} width={width} {...props} />);
  return { ...r, container: r.container as unknown as Node };
}

describe('vidéo d’accueil V2 (D-106)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fakeDocument.hidden = false;
    (globalThis as { document?: unknown }).document = fakeDocument;
  });
  afterAll(() => delete (globalThis as { document?: unknown }).document);

  it('natif : rien (décor fixe et PandaSprite restent)', async () => {
    await render(<NativeHomeVideo visible active {...base} width={390} />);
    expect(screen.toJSON()).toBeNull();
  });

  it('web : <video> muette en boucle, webm puis mp4, cadrée sans déformation, décorative ; invisible jusqu\'à la première image peinte, puis fondu de 200 ms', async () => {
    const { container } = await show();
    const video = all(container, 'video')[0]!;
    expect(video.props).toMatchObject({ autoPlay: true, muted: true, loop: true, playsInline: true, preload: 'auto', 'aria-hidden': true, tabIndex: -1 });
    expect(video.props.style).toMatchObject({ objectFit: 'cover' });
    expect(String((video.props.style as { objectPosition: string }).objectPosition)).toMatch(/^50% \d+(\.\d)?%$/);
    expect(all(container, 'source').map((s) => s.props.type)).toEqual(['video/webm', 'video/mp4']);
    expect(layer(container).props['aria-hidden']).toBe(true);
    // aucune <img> : l'aperçu fixe est une Image React Native posée par SceneHeader (HomePoster), visible même si la vidéo ne joue jamais
    expect(all(container, 'img')).toHaveLength(0);
    const box = () => all(container, 'div').find((d) => d.props['data-testid'] === 'v2-home-video-box')!;
    expect(box().props.style).toMatchObject({ opacity: 0, transition: 'opacity 200ms ease' });
    // « prête » sans image peinte (iPhone) : toujours invisible
    await act(async () => (video.props.onPlaying as (e: object) => void)({ currentTarget: { paused: false, currentTime: 0 } }));
    expect(box().props.style).toMatchObject({ opacity: 0 });
    expect(video.props.onCanPlay).toBeUndefined();
    // première image peinte : fondu vers la vidéo
    await act(async () => (video.props.onTimeUpdate as (e: object) => void)({ currentTarget: { paused: false, currentTime: 0.04 } }));
    expect(box().props.style).toMatchObject({ opacity: 1 });
  });

  it('iPhone : la vidéo est là dès le PREMIER rendu (aucune mesure attendue)', async () => {
    const r = await render(<HomeVideo visible active {...base} width={390} />);
    const container = r.container as unknown as Node;
    expect(all(container, 'video')).toHaveLength(1);
  });

  it.each([
    [390, 'home-teen@480'],
    [430, 'home-teen.mp4'],
  ])('largeur %i : mp4 « %s »', async (width, expected) => {
    const { container } = await show({}, width);
    expect(String(all(container, 'source')[1]!.props.src)).toBe(`asset:${expected}`);
  });

  it('pause quand l’onglet est caché, reprise au retour ; pause hors focus et pendant une réaction (fondu)', async () => {
    const r = await show();
    expect(mockSync).toHaveBeenLastCalledWith(true);
    fakeDocument.hidden = true;
    await act(async () => listeners.visibilitychange?.());
    expect(mockSync).toHaveBeenLastCalledWith(false);
    fakeDocument.hidden = false;
    await act(async () => listeners.visibilitychange?.());
    expect(mockSync).toHaveBeenLastCalledWith(true);
    await r.rerender(<HomeVideo visible active={false} {...base} width={390} />);
    expect(mockSync).toHaveBeenLastCalledWith(false);
    await r.rerender(<HomeVideo visible active {...base} width={390} />);
    expect(mockSync).toHaveBeenLastCalledWith(true);
    await r.rerender(<HomeVideo visible={false} active {...base} width={390} />);
    expect(mockSync).toHaveBeenLastCalledWith(false);
    expect(layer(r.container).props.style).toEqual(expect.arrayContaining([expect.objectContaining({ opacity: 0 })]));
  });

  it.each([
    [390, 'home-dong-hanh@480'],
    [430, 'home-dong-hanh.mp4'],
  ])('stade 4 (đồng hành) à %i px : ses propres fichiers, et un object-position calculé pour ses pieds', async (width, expected) => {
    const teen = await show({}, width);
    const teenPos = (all(teen.container, 'video')[0]!.props.style as { objectPosition: string }).objectPosition;
    await teen.unmount();
    const { container } = await show({ video: DONG_HANH }, width);
    const sources = all(container, 'source').map((s) => String(s.props.src));
    expect(sources).toEqual(['asset:home-dong-hanh.webm', `asset:${expected}`]);
    const pos = (all(container, 'video')[0]!.props.style as { objectPosition: string }).objectPosition;
    expect(pos).toMatch(/^50% \d+(\.\d)?%$/);
    expect(pos).not.toBe(teenPos);
  });

  it('stade 4 (đồng hành) à 390 px : boîte plus étroite que l’écran, centrée, bords fondus ; teen pleine largeur sans fondu', async () => {
    const box = (c: Node) => c.queryAll((n) => n.props['data-testid'] === 'v2-home-video-box')[0]!.props.style as Record<string, unknown>;
    const teen = await show({ topClear: 107 }, 390);
    expect(box(teen.container)).toMatchObject({ left: 0, width: 390, maskImage: undefined });
    await teen.unmount();
    const { container } = await show({ video: DONG_HANH, topClear: 107 }, 390);
    const s = box(container);
    expect(s.width as number).toBeLessThan(390);
    expect(s.left).toBe(Math.round((390 - (s.width as number)) / 2));
    expect(String(s.maskImage)).toContain('linear-gradient(to right, transparent 0, #000 24px');
    expect(s.WebkitMaskImage).toBe(s.maskImage);
  });

  it('aperçu fixe du stade 4 à 390 px : côtés floutés calés sur la ligne de sol, boîte aux bords fondus ; teen sans côtés', async () => {
    const H = { includeHiddenElements: true };
    const props = { topClear: 107, groundOffset: 24, width: 390, height: 347 };
    const teen = await render(<HomePoster video={TEEN} {...props} />);
    expect(screen.queryByTestId('v2-home-video-backdrop', H)).toBeNull();
    await teen.unmount();
    await render(<HomePoster video={DONG_HANH} {...props} />);
    const l = homeVideoLayout({ width: 390, height: 347, groundY: 323, topClear: 107 }, DONG_HANH.geometry);
    const flat = (id: string) => Object.assign({}, ...[screen.getByTestId(id, H).props.style].flat(3).filter(Boolean)) as Record<string, unknown>;
    expect(flat('v2-home-video-backdrop')).toMatchObject(l.backdrop);
    expect(flat('v2-home-video-poster-box')).toMatchObject({ left: l.boxLeft, width: l.boxWidth });
    expect(String(flat('v2-home-video-poster-box').maskImage)).toContain('#000 24px');
  });
});
