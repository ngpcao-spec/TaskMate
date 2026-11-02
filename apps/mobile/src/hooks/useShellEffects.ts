import { useEffect } from 'react';
import { badgeTotal } from '@/domain/notification-center';
import { useActivityPing } from '@/hooks/useActivityPing';
import { useApprovalCounts } from '@/hooks/useApprovals';
import { useMe } from '@/hooks/useMe';
import { useNotificationSetup, useReminderSync, useUnreadNotifications } from '@/hooks/useNotifications';
import { useRealtimeFamily } from '@/hooks/useRealtimeFamily';
import { useResumeAfterReload } from '@/hooks/useResumeAfterReload';
import { setAppBadge } from '@/pwa/appBadge';

/**
 * Effets communs aux deux interfaces (V1 `(tabs)` et V2 `(v2)`, D-106) : pastille de l'app, temps réel, dernière activité (D-102), reprise après
 * rechargement (D-103), notifications et rappels. Une seule copie : les deux layouts l'appellent.
 */
export function useShellEffects() {
  const me = useMe().data;
  const familyId = me?.family.id ?? null;
  const isParent = me?.member.role === 'parent';
  const approvals = useApprovalCounts(isParent);
  const unread = useUnreadNotifications();
  const badge = badgeTotal(unread, approvals.total);
  useEffect(() => setAppBadge(badge), [badge]);
  useRealtimeFamily(familyId);
  useActivityPing(familyId !== null);
  useResumeAfterReload();
  useNotificationSetup();
  useReminderSync();
  return { approvals, unread, isParent };
}
