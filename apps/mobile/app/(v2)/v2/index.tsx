import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useMe } from '@/hooks/useMe';
import { v2Colors } from '@/v2/theme';

/** Aiguillage de la V2 (D-106) : l'enfant vers ses onglets, le parent vers les siens. */
export default function V2Index() {
  const me = useMe().data;
  if (!me) {
    return (
      <View style={styles.screen}>
        <ActivityIndicator color={v2Colors.primary} />
      </View>
    );
  }
  return <Redirect href={me.member.role === 'child' ? '/v2/child/home' : '/v2/parent/home'} />;
}

const styles = StyleSheet.create({ screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: v2Colors.background } });
