import { act, render } from '@testing-library/react-native';
import { HomeVideo } from '@/v2/components/HomeVideo.web';
import type { HomeClip } from '@/v2/components/HomeVideo';

jest.mock('expo-asset', () => ({ Asset: { fromModule: (m: unknown) => ({ uri: `asset:${String(m)}` }) } }));
const mockSync = jest.fn();
jest.mock('@/v2/videoPlayback', () => ({ syncPlayback: (_el: unknown, playing: boolean) => mockSync(playing) }));

const src = (k: string) => ({ webm: `${k}.webm`, mp4: `${k}.mp4`, mp4Small: `${k}@480`, poster: `${k}-poster` });
const IDLE = { key: 'home-be', sources: src('home-be'), geometry: { width: 720, height: 1280, headY: 0.5, feetY: 0.725 }, groundColor: '#F7D495' };
const clip = (name: 'happy' | 'curious' | 'sleep', serial = 1): HomeClip => ({ name, key: `be-${name}`, sources: src(`be-${name}`), loop: false, serial });

type Node = { type: string; props: Record<string, unknown>; queryAll: (p: (n: Node) => boolean) => Node[] };
const videos = (c: Node) => c.queryAll((n) => n.type === 'video');
const box = (c: Node) => c.queryAll((n) => n.props['data-testid'] === 'v2-home-video-box')[0]!;
const paint = async (v: Node) => act(async () => (v.props.onTimeUpdate as (e: object) => void)({ currentTarget: { paused: false, currentTime: 0.04 } }));
const listeners: Record<string, () => void> = {};
const fakeDocument = { hidden: false, addEventListener: (n: string, f: () => void) => (listeners[n] = f), removeEventListener: (n: string) => delete listeners[n], createElement: () => ({ pause: jest.fn(), removeAttribute: jest.fn(), load: jest.fn() }) };

const base = { video: IDLE, visible: true, active: true, topClear: 107, groundOffset: 24, width: 390, height: 347 };

describe('panda vidéo : un seul lecteur pour le repos et les réactions (D-106)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    fakeDocument.hidden = false;
    (globalThis as { document?: unknown }).document = fakeDocument;
  });
  afterEach(() => jest.useRealTimers());
  afterAll(() => delete (globalThis as { document?: unknown }).document);

  it('ouverture : le repos démarre seul, en boucle ; jamais de rectangle noir avant la première image (couche invisible, aperçu dessous)', async () => {
    const r = await render(<HomeVideo {...base} />);
    const c = r.container as unknown as Node;
    expect(videos(c)).toHaveLength(1);
    expect(videos(c)[0]!.props).toMatchObject({ loop: true, muted: true, playsInline: true, autoPlay: true, 'data-anim': 'idle' });
    expect(box(c).props.style).toMatchObject({ opacity: 0 });
    await paint(videos(c)[0]!);
    expect(box(c).props['data-anim']).toBe('idle');
    expect(box(c).props.style).toMatchObject({ opacity: 1 });
  });

  it('réaction : préparée dans une 2ᵉ couche (une seule lecture), fondu croisé de 150 ms dès sa première image, puis l’ancienne couche part ; fin = `ended`', async () => {
    const onEnded = jest.fn();
    const onStarted = jest.fn();
    const r = await render(<HomeVideo {...base} onEnded={onEnded} onStarted={onStarted} />);
    const c = r.container as unknown as Node;
    await paint(videos(c)[0]!);
    await r.rerender(<HomeVideo {...base} clip={clip('happy')} onEnded={onEnded} onStarted={onStarted} />);
    expect(videos(c)).toHaveLength(2); // jamais plus de deux
    const happy = videos(c)[1]!;
    expect(happy.props).toMatchObject({ loop: false, preload: 'auto', 'data-anim': 'happy' });
    expect(happy.props.style).toMatchObject({ opacity: 0, transition: 'opacity 150ms ease' });
    expect(box(c).props['data-anim']).toBe('idle'); // l'image courante reste tant que la suivante n'est pas prête
    await paint(happy);
    expect(videos(c)[1]!.props.style).toMatchObject({ opacity: 1 });
    await act(async () => jest.advanceTimersByTime(150));
    expect(videos(c)).toHaveLength(1);
    expect(videos(c)[0]!.props['data-anim']).toBe('happy');
    expect(onStarted).toHaveBeenCalledWith('happy');
    // aucune fin par minuteur : seule la vraie fin de la vidéo compte
    await act(async () => jest.advanceTimersByTime(20_000));
    expect(onEnded).not.toHaveBeenCalled();
    await act(async () => (videos(c)[0]!.props.onEnded as () => void)());
    expect(onEnded).toHaveBeenCalledWith('happy');
  });

  it('réaction pas prête en 1,5 s : abandonnée, le panda reste au repos', async () => {
    const onFailed = jest.fn();
    const r = await render(<HomeVideo {...base} onFailed={onFailed} />);
    const c = r.container as unknown as Node;
    await paint(videos(c)[0]!);
    await r.rerender(<HomeVideo {...base} clip={clip('curious')} onFailed={onFailed} />);
    await act(async () => jest.advanceTimersByTime(1499));
    expect(onFailed).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(1));
    expect(onFailed).toHaveBeenCalledWith('curious');
    expect(videos(c)).toHaveLength(1);
    expect(videos(c)[0]!.props['data-anim']).toBe('idle');
  });

  it('vidéo indisponible (aucune source lisible) : abandon immédiat, image du repos', async () => {
    const onFailed = jest.fn();
    const r = await render(<HomeVideo {...base} onFailed={onFailed} />);
    const c = r.container as unknown as Node;
    await r.rerender(<HomeVideo {...base} clip={clip('happy')} onFailed={onFailed} />);
    const sources = (r.container as unknown as Node).queryAll((n) => n.type === 'source' && String(n.props.src).startsWith('asset:be-happy'));
    await act(async () => (sources[sources.length - 1]!.props.onError as () => void)());
    expect(onFailed).toHaveBeenCalledWith('happy');
    expect(videos(c).map((v) => v.props['data-anim'])).toEqual(['idle']);
  });

  it('panda endormi : image fixe à la place de toute vidéo ; au réveil, le repos repart d’une couche neuve', async () => {
    const r = await render(<HomeVideo {...base} still="be-sleep-end" />);
    const c = r.container as unknown as Node;
    expect(videos(c)).toHaveLength(0);
    const img = c.queryAll((n) => n.type === 'img')[0]!;
    expect(img.props.src).toBe('asset:be-sleep-end');
    expect(box(c).props.style).toMatchObject({ opacity: 1 });
    expect(box(c).props['data-anim']).toBe('sleep-still');
    await r.rerender(<HomeVideo {...base} />);
    expect(videos(c)).toHaveLength(1);
    expect(videos(c)[0]!.props['data-painted']).toBe('false');
  });

  it('arrière-plan puis retour : pause puis reprise (jamais d’écran noir : la dernière image reste)', async () => {
    const r = await render(<HomeVideo {...base} />);
    await paint(videos(r.container as unknown as Node)[0]!);
    expect(mockSync).toHaveBeenLastCalledWith(true);
    fakeDocument.hidden = true;
    await act(async () => listeners.visibilitychange?.());
    expect(mockSync).toHaveBeenLastCalledWith(false);
    fakeDocument.hidden = false;
    await act(async () => listeners.visibilitychange?.());
    expect(mockSync).toHaveBeenLastCalledWith(true);
  });
});
