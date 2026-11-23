import { usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { takeResume } from '@/services/resumeAfterReload';

/**
 * Après un rechargement voulu (« Tải lại » de l'écran d'erreur, D-103), rouvre la page où l'on était si la PWA iPhone est repartie de la page de départ.
 * La mémoire est lue au chargement de la page (voir `services/resumeAfterReload`) et ne sert qu'une fois, dans les secondes qui suivent.
 */
const ENTRY_REDIRECTS = ['/', '/v2'];

export function useResumeAfterReload(): void {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    // D-115 : `/` puis `/v2` sont des aiguillages qui redirigent aussitôt ; on attend l'écran d'arrivée (sinon la redirection écraserait la reprise)
    if (ENTRY_REDIRECTS.includes(pathname.replace(/\/+$/, '') || '/')) return;
    const target = takeResume();
    if (target !== null && target.split('?')[0] !== pathname) router.replace(target as never);
  }, [router, pathname]);
}
