import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { newId } from '@/api/ids';
import { fetchActivity, fetchDecidedRequests, fetchPrefs, savePrefs } from '@/api/notifications';
import { DEFAULT_PREFS, type NotificationPrefs } from '@/domain/notification-prefs';
import { planReminders } from '@/domain/reminders';
import { shiftDay } from '@/domain/calendar';
import { todayInTz } from '@/domain/family-time';
import i18n from '@/i18n';
import { useToastStore } from '@/store/toast';
import {
  configureNotifications,
  ensureNotificationPermission,
  handleNotificationResponse,
  registerPushToken,
  syncLocalReminders,
} from '@/services/notifications';
import { useMe } from './useMe';
import { useNow } from './useNow';
import { useTasks } from './useTasks';

export const prefsKey = (memberId: string) => ['notification-prefs', memberId] as const;

export function useNotificationPrefs() {
  const memberId = useMe().data?.member.id ?? null;
  return useQuery({
    queryKey: prefsKey(memberId ?? 'none'),
    queryFn: () => fetchPrefs(memberId as string),
    enabled: memberId !== null,
  });
}

export function useSavePrefs() {
  const queryClient = useQueryClient();
  const memberId = useMe().data?.member.id ?? null;
  const show = useToastStore((s) => s.show);
  return useMutation<void, unknown, NotificationPrefs>({
    networkMode: 'always',
    mutationFn: (prefs) => savePrefs(memberId as string, prefs),
    onSuccess: () => show(i18n.t('notifSettings.saved')),
    onError: () => show(i18n.t('common.error'), 'error'),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['notification-prefs'] }),
  });
}

export const useActivity = (enabled: boolean) => useQuery({ queryKey: ['activity'], queryFn: () => fetchActivity(), enabled });
export const useDecidedRequests = (enabled: boolean) => useQuery({ queryKey: ['requests', 'decided'], queryFn: () => fetchDecidedRequests(), enabled });

/** Configure les notifications, demande la permission, enregistre le jeton push et route les taps/boutons. */
export function useNotificationSetup(): void {
  const router = useRouter();
  const memberId = useMe().data?.member.id ?? null;
  useEffect(() => {
    if (!memberId || Platform.OS === 'web') return; // notifications natives uniquement
    let cancelled = false;
    void (async () => {
      await configureNotifications();
      const granted = await ensureNotificationPermission();
      if (granted && !cancelled) await registerPushToken().catch(() => undefined);
    })().catch(() => undefined);
    const deps = {
      approve: async (id: string) => (await import('@/api/points')).approveRewardRequest(id),
      reject: async (id: string) => (await import('@/api/points')).rejectRewardRequest(id),
      validateTask: async (id: string) => (await import('@/api/tasks')).validateTaskRpc(id, newId()),
      rejectTask: async (id: string) => (await import('@/api/tasks')).rejectTaskRpc(id),
      navigate: (href: string) => router.push(href as never),
    };
    const sub = Notifications.addNotificationResponseReceivedListener((r) => void handleNotificationResponse(r, deps));
    // démarrage à froid depuis une notification
    void Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r && !cancelled) void handleNotificationResponse(r, deps);
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [memberId, router]);
}

/**
 * Téléphone de l'enfant : replanifie ses rappels locaux à chaque synchro des tâches (7 jours glissants)
 * ou changement de préférences. Une tâche ajoutée par le parent arrive par Realtime → ce hook se relance.
 */
export function useReminderSync(): void {
  const me = useMe().data ?? null;
  const isChild = me?.member.role === 'child';
  const childId = isChild ? me.member.child_id : null;
  const tz = me?.family.timezone ?? 'Asia/Ho_Chi_Minh';
  const now = useNow();
  const today = todayInTz(now, tz);
  const prefs = useNotificationPrefs().data ?? DEFAULT_PREFS;
  const tasks = useTasks(childId, today, shiftDay(today, 6)).data;

  useEffect(() => {
    if (!isChild || !tasks || Platform.OS === 'web') return;
    let cancelled = false;
    void (async () => {
      if (!(await ensureNotificationPermission()) || cancelled) return;
      await syncLocalReminders(planReminders({ tasks, prefs, now: new Date(), timeZone: tz, today }));
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isChild, tasks, prefs, tz, today]);
}
