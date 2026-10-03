import { useState } from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import { Button, Card } from '@/components/ui';
import { generateVapidKeys, type VapidKeys } from '@/domain/vapid';
import i18n from '@/i18n';
import { colors, typography } from '@/theme/tokens';

const tf = i18n.getFixedT('fr');

/** Générateur de clés VAPID dans le navigateur (aucun outil à installer). Web uniquement ; clés non stockées. */
export function VapidTool() {
  const [keys, setKeys] = useState<VapidKeys | null>(null);
  const [copied, setCopied] = useState<'publicKey' | 'privateKey' | null>(null);
  if (Platform.OS !== 'web') return null;

  const copy = async (which: 'publicKey' | 'privateKey') => {
    if (!keys) return;
    try {
      await navigator.clipboard.writeText(keys[which]);
      setCopied(which);
    } catch {
      setCopied(null); // presse-papiers refusé : le texte reste sélectionnable
    }
  };

  return (
    <Card>
      <Text accessibilityRole="header" style={styles.title}>
        {tf('health.vapidTool.title')}
      </Text>
      <Text style={typography.secondary}>{tf('health.vapidTool.body')}</Text>
      <Button variant="secondary" label={tf('health.vapidTool.generate')} onPress={() => void generateVapidKeys().then((k) => { setKeys(k); setCopied(null); })} />
      {keys ? (
        <>
          <Text style={styles.label}>{tf('health.vapidTool.publicLabel')}</Text>
          <Text selectable style={styles.key}>{keys.publicKey}</Text>
          <Button variant="ghost" label={copied === 'publicKey' ? tf('health.vapidTool.copied') : tf('health.vapidTool.copy')} accessibilityLabel={`${tf('health.vapidTool.copy')} — ${tf('health.vapidTool.publicLabel')}`} onPress={() => void copy('publicKey')} />
          <Text style={styles.label}>{tf('health.vapidTool.privateLabel')}</Text>
          <Text selectable style={styles.key}>{keys.privateKey}</Text>
          <Button variant="ghost" label={copied === 'privateKey' ? tf('health.vapidTool.copied') : tf('health.vapidTool.copy')} accessibilityLabel={`${tf('health.vapidTool.copy')} — ${tf('health.vapidTool.privateLabel')}`} onPress={() => void copy('privateKey')} />
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  label: { fontSize: 13, fontWeight: '700', color: colors.text },
  key: { fontSize: 12, color: colors.text, fontFamily: Platform.select({ web: 'monospace', default: undefined }) },
});
