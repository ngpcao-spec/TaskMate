import { Redirect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';
import { ChildrenStep } from '@/components/onboarding/ChildrenStep';
import { ContentStep } from '@/components/onboarding/ContentStep';
import { CoparentStep } from '@/components/onboarding/CoparentStep';
import { LanguageStep } from '@/components/onboarding/LanguageStep';
import { NotificationsStep } from '@/components/onboarding/NotificationsStep';
import { SubjectsStep } from '@/components/onboarding/SubjectsStep';
import { Button, ErrorText, Screen } from '@/components/ui';
import { isStepKey, stepsFor } from '@/domain/onboarding';
import { useMe } from '@/hooks/useMe';
import { useOnboarding } from '@/hooks/useOnboarding';
import { colors } from '@/theme/tokens';

/** Une étape de l'assistant de première connexion (D-090) : PARENT uniquement, une route par étape (reprise possible à n'importe quelle étape). */
export default function SetupStepScreen() {
  const { step } = useLocalSearchParams<{ step?: string }>();
  const { t } = useTranslation();
  const me = useMe().data;
  const ob = useOnboarding();
  // `me` pas encore lu (ou relu après un cache périmé, D-098) : jamais un écran vide
  if (!me || ob.isPending) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} accessibilityLabel={t('onboarding.wizard.loading')} />
      </Screen>
    );
  }
  if (me.member.role !== 'parent') return <Redirect href="/" />;
  if (!ob.facts) {
    return (
      <Screen>
        <ErrorText>{t('onboarding.wizard.error')}</ErrorText>
        <Button label={t('quizDetail.retry')} onPress={ob.refetch} />
      </Screen>
    );
  }
  const facts = ob.facts;
  if (!isStepKey(step) || !stepsFor(facts.isOwner).includes(step)) return <Redirect href="/onboarding/setup" />;
  switch (step) {
    case 'language':
      return <LanguageStep facts={facts} />;
    case 'children':
      return <ChildrenStep facts={facts} />;
    case 'subjects':
      return <SubjectsStep facts={facts} />;
    case 'notifications':
      return <NotificationsStep facts={facts} />;
    case 'content':
      return <ContentStep facts={facts} />;
    case 'coparent':
      return <CoparentStep facts={facts} />;
  }
}
