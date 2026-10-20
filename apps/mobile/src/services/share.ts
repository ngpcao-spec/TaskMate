import { Share } from 'react-native';
import { copyText } from '@/services/clipboard';

/** Partage un texte par la feuille de partage du système ; repli : copie. Renvoie 'shared' | 'copied' | 'failed' (annuler le partage n'est pas un échec). */
export async function shareText(title: string, text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    await Share.share({ title, message: text });
    return 'shared';
  } catch {
    return (await copyText(text)) ? 'copied' : 'failed';
  }
}
