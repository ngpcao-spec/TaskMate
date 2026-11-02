import { act, render, screen } from '@testing-library/react-native';
import { HomeVideo } from '@/v2/components/HomeVideo.web';
import { HomeVideo as NativeHomeVideo } from '@/v2/components/HomeVideo';

jest.mock('expo-asset', () => ({ Asset: { fromModule: (m: unknown) => ({ uri: `asset:${String(m)}` }) } }));
// chaque fichier vidéo devient un nom lisible (les `require` du module `src/v2/video.ts`)
jest.mock('@/v2/video', () => ({ HOME_VIDEO_SOURCES: { webm: 'home-teen.webm', mp4: 'home-teen.mp4', mp4Small: 'home-teen@480', poster: 'home-teen-poster' } }));

type Node = { type: string; props: Record<string, unknown>; children: unknown[]; queryAll: (p: (n: Node) => boolean) => Node[] };
const listeners: Record<string, () => void> = {};
const fakeDocument = { hidden: false, addEventListener: (n: string, f: () => void) => (listeners[n] = f), removeEventListener: (n: string) => delete listeners[n] };
const mockSync = jest.fn();
jest.mock('@/v2/videoPlayback', () => ({ syncPlayback: (_el: unknown, playing: boolean) => mockSync(playing) }));

/** Les éléments DOM (`video`, `img`, `source`) rendus par le composant web, trouvés par type (ils sont décoratifs, donc cachés aux requêtes RNTL). */
const all = (container: Node, type: string) => container.queryAll((n) => n.type === type);
const layer = (container: Node) => container.queryAll((n) => n.props.testID === 'v2-home-video')[0]!;

const base = { topClear: 60, groundOffset: 24, height: 347 };
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

  it('web : <video> muette en boucle, webm puis mp4, cadrée sans déformation, décorative ; poster puis fondu de 200 ms', async () => {
    const { container } = await show();
    const video = all(container, 'video')[0]!;
    expect(video.props).toMatchObject({ autoPlay: true, muted: true, loop: true, playsInline: true, preload: 'auto', 'aria-hidden': true, tabIndex: -1 });
    expect(video.props.style).toMatchObject({ objectFit: 'cover' });
    expect(String((video.props.style as { objectPosition: string }).objectPosition)).toMatch(/^50% \d+(\.\d)?%$/);
    expect(all(container, 'source').map((s) => s.props.type)).toEqual(['video/webm', 'video/mp4']);
    expect(layer(container).props['aria-hidden']).toBe(true);
    const poster = () => all(container, 'img').find((i) => i.props['data-testid'] === 'v2-home-video-poster')!;
    expect(poster().props.style).toMatchObject({ opacity: 1, transition: 'opacity 200ms ease' });
    // « prête » sans image peinte (iPhone) : le poster reste
    await act(async () => (video.props.onPlaying as (e: object) => void)({ currentTarget: { paused: false, currentTime: 0 } }));
    expect(poster().props.style).toMatchObject({ opacity: 1 });
    expect(video.props.onCanPlay).toBeUndefined();
    // première image peinte : fondu
    await act(async () => (video.props.onTimeUpdate as (e: object) => void)({ currentTarget: { paused: false, currentTime: 0.04 } }));
    expect(poster().props.style).toMatchObject({ opacity: 0 });
  });

  it('iPhone : le poster et la vidéo sont là dès le PREMIER rendu (aucune mesure attendue, pas de saut depuis le décor fixe)', async () => {
    const r = await render(<HomeVideo visible active {...base} width={390} />);
    const container = r.container as unknown as Node;
    expect(all(container, 'video')).toHaveLength(1);
    expect(all(container, 'img').some((i) => i.props['data-testid'] === 'v2-home-video-poster')).toBe(true);
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
});
