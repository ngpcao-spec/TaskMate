import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useEntryRoute } from '@/hooks/useMe';
import { colors } from '@/theme/tokens';

export default function Index() {
  const route = useEntryRoute();
  if (route === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return <Redirect href={route} />;
}
