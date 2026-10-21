import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui';
import { CRASH_KEY, crashReport, crashText } from '@/domain/crash-report';
import { kvStorage } from '@/sync/storage';
import { reloadApp } from '@/theme/themeStore';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type Props = { error: unknown; retry: () => void };

/**
 * Écran d'erreur racine (D-094). Sans lui, une exception pendant l'affichage démonte TOUTE l'application et il ne reste qu'un écran uni, de la couleur du thème
 * (constaté sur iPhone en fin de parcours). Ici : un message clair, le détail technique (à recopier pour un signalement), « Thử lại » et « Tải lại ứng dụng ».
 * N'utilise ni requête ni navigation : il doit s'afficher même si le reste est cassé.
 */
export function AppErrorScreen({ error, retry }: Props) {
  const { t } = useTranslation();
  const report = useMemo(() => crashReport(error, new Date(), globalThis.location?.pathname ?? ''), [error]);
  useEffect(() => {
    console.error('[TaskMate] erreur d\'affichage', error);
    try {
      kvStorage.setItem(CRASH_KEY, JSON.stringify(report));
    } catch {
      // stockage indisponible : le détail reste à l'écran
    }
  }, [error, report]);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>{t('errorScreen.title')}</Text>
        <Text style={typography.body}>{t('errorScreen.body')}</Text>
        <Button label={t('errorScreen.retry')} onPress={retry} />
        <Button variant="secondary" label={t('errorScreen.reload')} onPress={() => void reloadApp()} />
        <Text style={typography.secondary}>{t('errorScreen.detail')}</Text>
        <Text selectable accessibilityLabel={t('errorScreen.detailLabel')} style={styles.detail}>{crashText(report)}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  title: { ...typography.title, fontSize: 24, color: colors.text },
  detail: { fontSize: 12, lineHeight: 17, color: colors.text, backgroundColor: colors.cardSolid, borderRadius: radius.control, padding: spacing.md },
});
