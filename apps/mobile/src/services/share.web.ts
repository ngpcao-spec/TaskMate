export type ShareOutcome = 'shared' | 'copied' | 'failed';

/** Web : feuille de partage du navigateur si disponible (mobile), sinon copie dans le presse-papiers. */
export async function shareLink(url: string): Promise<ShareOutcome> {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share({ url });
      return 'shared';
    }
  } catch (error) {
    if ((error as { name?: string }).name === 'AbortError') return 'failed'; // l'utilisateur a annulé
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
