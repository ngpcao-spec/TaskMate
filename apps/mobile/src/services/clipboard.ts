import * as Clipboard from 'expo-clipboard';

/** Copie un texte dans le presse-papiers (natif et web). Renvoie false si le système refuse (permission, contexte non sécurisé). */
export async function copyText(text: string): Promise<boolean> {
  try {
    return await Clipboard.setStringAsync(text);
  } catch {
    return false;
  }
}
