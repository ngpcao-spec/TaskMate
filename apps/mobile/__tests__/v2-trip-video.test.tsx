import { act, render, screen } from '@testing-library/react-native';
import { TripVideo } from '@/v2/components/TripVideo.web';
import { TripVideo as NativeTripVideo } from '@/v2/components/TripVideo';

jest.mock('expo-asset', () => ({ Asset: { fromModule: (m: unknown) => ({ uri: `asset:${String(m)}` }) } }));
const TRIP = {
  key: 'trip-be',
  sources: { webm: 'trip-be.webm', mp4: 'trip-be.mp4', mp4Small: 'trip-be@480', poster: 'trip-be-poster' },
  geometry: { width: 1280, height: 720, headY: 0.44, feetY: 0.82 },
};

type Node = { type: string; props: Record<string, unknown>; queryAll: (p: (n: Node) => boolean) => Node[] };
const all = (c: Node, type: string) => c.queryAll((n) => n.type === type);
const boxOf = (c: Node) => all(c, 'div').find((d) => d.props['data-testid'] === 'v2-trip-video-box')!;
const listeners: Record<string, () => void> = {};
const fakeDocument = { hidden: false, addEventListener: (n: string, f: () => void) => (listeners[n] = f), removeEventListener: (n: string) => delete listeners[n] };
const base = { video: TRIP, topClear: 60, groundOffset: 24, width: 390, height: 347 };

/** Élément `<video>` simulé : `play()` réussit ou est refusé par le navigateur. */
function fakeVideo(refuse = false) {
  return {
    play: jest.fn(() => (refuse ? Promise.reject(Object.assign(new Error('refusée'), { name: 'NotAllowedError' })) : Promise.resolve())),
    pause: jest.fn(),
    load: jest.fn(),
    removeAttribute: jest.fn(),
  };
}
async function show(props: Partial<Parameters<typeof TripVideo>[0]> = {}, el = fakeVideo()) {
  const onFailed = jest.fn();
  const r = await render(<TripVideo mode="video" active onFailed={onFailed} {...base} {...props} />);
  const container = r.container as unknown as Node;
  // l'élément DOM simulé est attaché par la fonction `ref` du <video>
  const v = all(container, 'video')[0];
  if (v) await act(async () => (v.props.ref as (x: unknown) => void)(el));
  return { container, onFailed, el, r };
}

describe('vidéo de voyage (D-107)', () => {
  beforeEach(() => {
    fakeDocument.hidden = false;
    (globalThis as { document?: unknown }).document = fakeDocument;
  });
  afterAll(() => delete (globalThis as { document?: unknown }).document);

  it('natif : rien (maison vide + mot)', async () => {
    await render(<NativeTripVideo mode="video" active onFailed={jest.fn()} {...base} />);
    expect(screen.toJSON()).toBeNull();
  });

  it('web : <video> muette, en boucle, playsInline, poster, webm puis mp4 ; posée sur son aperçu fixe ; visible seulement une fois une image peinte', async () => {
    const { container, el } = await show();
    const video = all(container, 'video')[0]!;
    expect(video.props).toMatchObject({ autoPlay: true, muted: true, loop: true, playsInline: true, 'aria-hidden': true, tabIndex: -1, poster: 'asset:trip-be-poster' });
    expect(all(container, 'source').map((s) => s.props.src)).toEqual(['asset:trip-be.webm', 'asset:trip-be@480']);
    expect(screen.getByTestId('v2-trip-video-poster', { includeHiddenElements: true })).toBeTruthy();
    expect(el.play).toHaveBeenCalled();
    expect(boxOf(container).props['data-ready']).toBe('false');
    expect(video.props.style).toMatchObject({ opacity: 0, objectFit: 'fill' });
    await act(async () => (video.props.onPlaying as (e: object) => void)({ currentTarget: { paused: false, currentTime: 0.1 } }));
    expect(boxOf(container).props['data-ready']).toBe('true');
    expect(all(container, 'video')[0]!.props.style).toMatchObject({ opacity: 1 });
  });

  it('cadrage : rectangle exact de l’image (16:9, toute la hauteur), descendu pour poser les pieds sur la ligne de sol', async () => {
    const { container } = await show();
    const st = all(container, 'video')[0]!.props.style as { top: number; width: number; height: number; left: number };
    expect(st.height).toBe(347);
    expect(st.width).toBe(Math.round((1280 * 347) / 720));
    expect(st.top).toBeGreaterThan(0);
    expect(Number(boxOf(container).props['data-panda-bottom'])).toBeCloseTo(347 - 24, -1);
  });

  it('« réduire les animations » : aperçu fixe seulement, aucune vidéo', async () => {
    const { container } = await show({ mode: 'still' });
    expect(all(container, 'video')).toHaveLength(0);
    expect(boxOf(container).props['data-ready']).toBe('true');
  });

  it('lecture refusée par le navigateur ou aucune source lisible : onFailed (maison vide + mot)', async () => {
    const refused = await show({}, fakeVideo(true));
    await act(async () => undefined);
    expect(refused.onFailed).toHaveBeenCalledTimes(1);
    await refused.r.unmount();
    const { container, onFailed } = await show();
    const sources = all(container, 'source');
    await act(async () => (sources[sources.length - 1]!.props.onError as () => void)());
    expect(onFailed).toHaveBeenCalledTimes(1);
  });

  it('pause quand Hôm nay perd le focus ou que l’onglet est caché ; libérée au démontage', async () => {
    const { el, r } = await show();
    await r.rerender(<TripVideo mode="video" active={false} onFailed={jest.fn()} {...base} />);
    expect(el.pause).toHaveBeenCalled();
    await r.rerender(<TripVideo mode="video" active onFailed={jest.fn()} {...base} />);
    el.pause.mockClear();
    fakeDocument.hidden = true;
    await act(async () => listeners.visibilitychange!());
    expect(el.pause).toHaveBeenCalled();
    await r.unmount();
    expect(el.removeAttribute).toHaveBeenCalledWith('src');
  });
});
