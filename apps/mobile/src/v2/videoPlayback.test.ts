import { syncPlayback } from './videoPlayback';

describe('lecture de la vidéo d’accueil', () => {
  it('lit ou met en pause ; ignore un élément absent ou une lecture refusée', async () => {
    const el = { play: jest.fn(() => Promise.reject(new Error('NotAllowedError'))), pause: jest.fn() };
    syncPlayback(el, true);
    expect(el.play).toHaveBeenCalled();
    syncPlayback(el, false);
    expect(el.pause).toHaveBeenCalled();
    expect(() => syncPlayback(null, true)).not.toThrow();
    expect(() => syncPlayback({}, true)).not.toThrow();
    await Promise.resolve();
  });
});
