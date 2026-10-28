import { usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { decodeResume, RESUME_KEY } from '@/domain/resume-path';

/**
 * Après un rechargement voulu (changement de thème, D-103), rouvre la page où l'on était si le navigateur est reparti de la page de départ
 * (PWA iPhone). La mémoire est LUE PUIS EFFACÉE : elle ne sert qu'une fois. Sans stockage (natif, navigation privée) : ne fait rien.
 */
export function useResumeAfterReload(): void {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    let target: string | null = null;
    try {
      const raw = globalThis.localStorage?.getItem(RESUME_KEY) ?? null;
      if (raw !== null) {
        globalThis.localStorage.removeItem(RESUME_KEY);
        target = decodeResume(raw, Date.now());
      }
    } catch {
      target = null;
    }
    if (target !== null && target.split('?')[0] !== pathname) router.replace(target as never);
  }, [router, pathname]);
}
