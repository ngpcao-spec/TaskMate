import { copyText } from '@/services/clipboard';

/** Web : Web Share API si disponible (contexte sécurisé, geste de l'utilisateur), sinon copie dans le presse-papiers. */
export async function shareText(title: string, text: string): Promise<'shared' | 'copied' | 'failed'> {
  const nav = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { share?: (data: { title?: string; text?: string }) => Promise<void> });
  if (nav?.share) {
    try {
      await nav.share({ title, text });
      return 'shared';
    } catch (error) {
      // l'utilisateur ferme la feuille de partage : rien à faire ; toute autre erreur → copie
      if ((error as { name?: string } | null)?.name === 'AbortError') return 'shared';
    }
  }
  return (await copyText(text)) ? 'copied' : 'failed';
}
