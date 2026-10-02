import { documentTitleFor } from '@/domain/notification-center';

type BadgeNavigator = Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

export function setAppBadge(count: number): void {
  if (typeof document === 'undefined') return;
  document.title = documentTitleFor(count);
  const nav = navigator as BadgeNavigator;
  const apply = count > 0 ? nav.setAppBadge?.(count) : nav.clearAppBadge?.();
  void apply?.catch(() => undefined); // non supporté / non installé : ignoré
}
