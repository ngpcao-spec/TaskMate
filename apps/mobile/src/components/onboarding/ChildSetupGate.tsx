import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { childSetupSeenKey, shouldShowChildSetup } from '@/domain/onboarding';
import { useMe } from '@/hooks/useMe';
import { thisDeviceRegistered } from '@/services/webPush';
import { kvStorage } from '@/sync/storage';

/** Premier login d'un enfant sans appareil actif : ouvre UNE fois le mini-parcours (marqué « vu » dès l'ouverture, quelle que soit la suite). Ne rend rien. */
export function ChildSetupGate() {
  const router = useRouter();
  const me = useMe().data;
  const memberId = me?.member.role === 'child' ? me.member.id : null;
  useEffect(() => {
    if (!memberId) return;
    const key = childSetupSeenKey(memberId);
    const seen = kvStorage.getItem(key) !== null;
    if (seen) return;
    let alive = true;
    void thisDeviceRegistered()
      .then((registered) => {
        if (!alive) return;
        kvStorage.setItem(key, '1');
        if (shouldShowChildSetup(false, registered)) router.push('/onboarding/child-setup');
      })
      .catch(() => undefined); // état illisible (hors ligne) : on réessaiera à la prochaine ouverture
    return () => {
      alive = false;
    };
  }, [memberId, router]);
  return null;
}
