import { Share } from 'react-native';

export type ShareOutcome = 'shared' | 'copied' | 'failed';

/** Partage natif d'un lien (feuille de partage du système). */
export async function shareLink(url: string): Promise<ShareOutcome> {
  try {
    await Share.share({ message: url });
    return 'shared';
  } catch {
    return 'failed';
  }
}
