import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { Button, Card, Screen, ScreenHeader } from '@/components/ui';
import { typography } from '@/theme/tokens';

/**
 * Le QCM (ou la tentative) a été supprimé définitivement par l'administrateur (D-091) alors que l'écran était ouvert ou venait d'une notification : message clair
 * et retour, jamais un écran vide ni une erreur technique.
 */
export function QuizGone() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Screen>
      <ScreenHeader title={t('revisions.title')} />
      <Card>
        <Text accessibilityRole="header" style={typography.body}>{t('revisions.gone')}</Text>
        <Text style={typography.secondary}>{t('revisions.goneBody')}</Text>
      </Card>
      <Button label={t('revisions.child.back')} onPress={() => router.back()} />
    </Screen>
  );
}
