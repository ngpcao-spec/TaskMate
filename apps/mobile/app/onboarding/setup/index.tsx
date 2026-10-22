import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { resumeStep, stepPath } from '@/domain/onboarding';
import { useMe } from '@/hooks/useMe';
import { useOnboarding } from '@/hooks/useOnboarding';
import { colors } from '@/theme/tokens';

/** Entrée de l'assistant : REPREND à la première étape à faire (d'après les données réelles) ; tout fait → Hôm nay. */
export default function SetupIndex() {
  const me = useMe().data;
  const ob = useOnboarding();
  if (me && me.member.role !== 'parent') return <Redirect href="/" />;
  if (!me || ob.isPending) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  // lecture impossible : l'écran de la première étape affiche l'erreur et « Thử lại »
  if (!ob.facts) return <Redirect href={stepPath('language')} />;
  const step = resumeStep(ob.facts);
  return <Redirect href={step ? stepPath(step) : '/(tabs)/today'} />;
}
