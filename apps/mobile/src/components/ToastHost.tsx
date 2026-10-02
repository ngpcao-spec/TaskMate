import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore } from '@/store/toast';
import { colors, radius, shadow } from '@/theme/tokens';

/** Toast unique, auto-masqué après 3 s. À monter une fois à la racine. */
export function ToastHost() {
  const toast = useToastStore((s) => s.toast);
  const dismiss = useToastStore((s) => s.dismiss);
  const insets = useSafeAreaInsets();
  const id = toast?.id;
  useEffect(() => {
    if (id === undefined) return;
    const timer = setTimeout(dismiss, 3000);
    return () => clearTimeout(timer);
  }, [id, dismiss]);
  if (!toast) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 90 }]}>
      <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.toast, toast.tone === 'error' && styles.error]}>
        <Text style={styles.text}>{toast.message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: { backgroundColor: colors.text, borderRadius: radius.card, paddingHorizontal: 16, paddingVertical: 12, ...shadow },
  error: { backgroundColor: colors.danger },
  text: { color: '#fff', fontSize: 14 },
});
