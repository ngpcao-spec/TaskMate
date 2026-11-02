import { useFonts } from 'expo-font';
import { Redirect, Stack } from 'expo-router';
import { View } from 'react-native';
import { useEntryRoute } from '@/hooks/useMe';
import { useShellEffects } from '@/hooks/useShellEffects';
import { v2Colors, V2_FONT_FILES } from '@/v2/theme';

/**
 * Arbre de l'interface V2 (D-106), choisi par `families.ui_version`. Mêmes effets que la V1 (`useShellEffects`) ; polices Nunito chargées sans
 * bloquer l'affichage (repli système). Une famille en V1 qui arrive ici est renvoyée à l'aiguillage (`/`).
 */
export default function V2Layout() {
  const route = useEntryRoute();
  useShellEffects();
  useFonts(V2_FONT_FILES);
  if (route !== 'loading' && route !== '/v2') return <Redirect href="/" />;
  return (
    <View style={{ flex: 1, backgroundColor: v2Colors.background }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: v2Colors.background } }} />
    </View>
  );
}
