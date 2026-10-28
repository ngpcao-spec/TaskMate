import { usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { takeResume } from '@/services/resumeAfterReload';

/**
 * Après un rechargement voulu (changement de thème, D-103), rouvre la page où l'on était si la PWA iPhone est repartie de la page de départ.
 * La mémoire est lue au chargement de la page (voir `services/resumeAfterReload`) et ne sert qu'une fois, dans les secondes qui suivent.
 */
export function useResumeAfterReload(): void {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const target = takeResume();
    if (target !== null && target.split('?')[0] !== pathname) router.replace(target as never);
  }, [router, pathname]);
}
