import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { NotificationSetup } from '@/components/onboarding/NotificationSetup';
import { Button, Screen, ScreenHeader } from '@/components/ui';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';

/**
 * Mini-parcours de l'enfant (1 écran, 2 gestes) : « Thêm vào Màn hình chính » (iOS hors PWA) puis « Bật thông báo », avec un exemple de notification.
 * L'enfant ne voit que ses propres données (D-052). « Để sau » ferme sans rien faire ; l'écran reste accessible depuis ses Réglages.
 */
export function ChildSetup() {
  const { t } = useTranslation();
  const router = useRouter();
  const d = useDisplayedChild();
  if (!d || d.viewer.role !== 'child') return null;
  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/today'));
  return (
    <Screen>
      <ScreenHeader title={t('onboarding.child.title', { name: d.child?.name ?? '' })} onBack={close} multiline />
      <NotificationSetup example={t('onboarding.child.example')} />
      <Button variant="ghost" label={t('onboarding.child.later')} onPress={close} />
    </Screen>
  );
}
