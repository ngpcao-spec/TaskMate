import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/api/keys';
import { ParentInviteCard } from '@/components/ParentInviteCard';
import { useStepNav } from '@/components/onboarding/useStepNav';
import { WizardShell } from '@/components/onboarding/WizardShell';
import type { OnboardingFacts } from '@/domain/onboarding';

/** Étape 6 — deuxième parent (facultatif) : le code d'invitation existant (haché en base, valable 24 h), à copier ou partager. */
export function CoparentStep({ facts }: { facts: OnboardingFacts }) {
  const { t } = useTranslation();
  const nav = useStepNav('coparent', facts);
  const queryClient = useQueryClient();
  const finish = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.onboarding });
    nav.goNext();
  };
  return (
    <WizardShell
      number={nav.number}
      total={nav.total}
      title={t('onboarding.coparent.title')}
      subtitle={t('onboarding.coparent.subtitle')}
      onNext={finish}
      nextLabel={nav.isLast ? t('onboarding.wizard.finish') : undefined}
      onSkip={nav.skip ? () => void nav.skip?.() : undefined}
      skipLoading={nav.skipping}
      onBack={nav.goBack}
    >
      <ParentInviteCard />
    </WizardShell>
  );
}
