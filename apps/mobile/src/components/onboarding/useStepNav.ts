import { useRouter } from 'expo-router';
import { canSkipStep, neighbour, stepNumber, stepPath, stepsFor, type OnboardingFacts, type StepKey } from '@/domain/onboarding';
import { useOnboardingStep } from '@/hooks/useOnboarding';

/** Navigation d'une étape de l'assistant : suivante / précédente, « Bỏ qua bước này » (absent à l'étape enfants tant qu'aucun enfant n'existe). */
export function useStepNav(step: StepKey, facts: OnboardingFacts) {
  const router = useRouter();
  const setStep = useOnboardingStep();
  const next = neighbour(step, facts.isOwner, 1);
  const prev = neighbour(step, facts.isOwner, -1);
  const goNext = () => router.replace(next ? stepPath(next) : '/(tabs)/today');
  const goBack = prev ? () => router.replace(stepPath(prev)) : undefined;
  const skip = canSkipStep(step, facts.children.length)
    ? async () => {
        try {
          await setStep.mutateAsync({ step, action: 'skip' });
        } catch {
          return; // l'échec est annoncé par la mutation ; on ne quitte pas l'étape
        }
        goNext();
      }
    : undefined;
  return { number: stepNumber(step, facts.isOwner), total: stepsFor(facts.isOwner).length, goNext, goBack, skip, skipping: setStep.isPending, isLast: next === null };
}
