import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { queryKeys } from '@/api/keys';
import { NotificationSetup } from '@/components/onboarding/NotificationSetup';
import { useStepNav } from '@/components/onboarding/useStepNav';
import { WizardShell } from '@/components/onboarding/WizardShell';
import { Card, Field } from '@/components/ui';
import { isValidTime } from '@/domain/notification-prefs';
import type { OnboardingFacts } from '@/domain/onboarding';
import { useNotificationPrefs, useSavePrefs } from '@/hooks/useNotifications';

/** Étape 4 — installer et notifier : installation (iOS), activation vérifiée en base, notification de test, heure du récap du soir (réglage existant, défaut 20:30). */
export function NotificationsStep({ facts }: { facts: OnboardingFacts }) {
  const { t } = useTranslation();
  const nav = useStepNav('notifications', facts);
  const queryClient = useQueryClient();
  const prefs = useNotificationPrefs();
  const save = useSavePrefs();
  const [time, setTime] = useState<string | null>(null);
  const stored = prefs.data?.eveningRecap.time ?? '20:30';
  const shown = time ?? stored;
  const valid = isValidTime(shown);

  const next = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.onboarding });
    if (prefs.data && valid && shown !== stored) save.mutate({ ...prefs.data, eveningRecap: { ...prefs.data.eveningRecap, time: shown } });
    nav.goNext();
  };

  return (
    <WizardShell
      number={nav.number}
      total={nav.total}
      title={t('onboarding.notifications.title')}
      subtitle={t('onboarding.notifications.subtitle')}
      onNext={next}
      nextDisabled={!valid}
      nextLabel={nav.isLast ? t('onboarding.wizard.finish') : undefined}
      onSkip={nav.skip ? () => void nav.skip?.() : undefined}
      skipLoading={nav.skipping}
      onBack={nav.goBack}
    >
      <NotificationSetup />
      <Card>
        <Field label={t('notifSettings.recapTime')} value={shown} onChangeText={setTime} placeholder="20:30" maxLength={5} error={valid ? null : t('notifSettings.invalidTime')} />
      </Card>
    </WizardShell>
  );
}
