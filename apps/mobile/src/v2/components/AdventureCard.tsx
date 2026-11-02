import { Map as MapIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { pandaExpressionImage } from '@/components/companion/pandaImages';
import type { AdventureState } from '@/domain/adventure';
import type { PandaVariant } from '@/domain/panda';
import { v2Card, v2Colors, v2Radius, v2Spacing, v2Text, V2_TOUCH } from '../theme';

type Props = {
  adventure: AdventureState;
  pandaName: string;
  variant?: PandaVariant;
  /** pendant `away` : avancée 0..1 du panda entre ⚡ et « ? » (`awayProgress`) */
  progress?: number;
  onMap: () => void;
  /** jauge pleine : choisir la destination */
  onGo?: () => void;
  /** retour : ouvrir la trouvaille */
  onOpenBag?: () => void;
  /** écriture en attente (hors ligne) : boutons désactivés */
  busy?: boolean;
};

function Gauge({ value, cost, labelKey, valueKey }: { value: number; cost: number; labelKey: string; valueKey: string }) {
  const { t } = useTranslation();
  const pct = cost > 0 ? Math.round((Math.min(value, cost) / cost) * 100) : 0;
  return (
    <View style={styles.gaugeRow} accessibilityRole="progressbar" accessibilityLabel={t(labelKey, { value, cost })} accessibilityValue={{ min: 0, max: cost, now: Math.min(value, cost) }}>
      <Text style={styles.gaugeText} importantForAccessibility="no">
        {t(valueKey, { value, cost })} ⚡
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

function PrimaryButton({ label, onPress, disabled }: { label: string; onPress?: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled || !onPress} onPress={onPress} style={({ pressed }) => [styles.primary, pressed ? styles.primaryPressed : null, disabled ? styles.disabled : null]}>
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

/** Carte d'aventure de Hôm nay (V2) : jauge « Phiêu lưu 18/60 » ⚡, départ, voyage (chemin ⚡ → ?), retour. */
export function AdventureCard({ adventure, pandaName, variant = 'boy', progress = 0, onMap, onGo, onOpenBag, busy = false }: Props) {
  const { t } = useTranslation();
  const p = Math.max(0, Math.min(1, progress));
  return (
    <View style={styles.card} testID={`v2-adventure-${adventure.state}`}>
      <View style={styles.head}>
        <View style={styles.headText}>
          {adventure.state === 'away' ? (
            <Text style={styles.title}>{t('v2.adventure.away')}</Text>
          ) : adventure.state === 'back' ? (
            <Text style={styles.title}>{t('v2.adventure.back', { name: pandaName })}</Text>
          ) : (
            <Gauge value={adventure.gauge} cost={adventure.cost} labelKey="adventure.gaugeLabel" valueKey="adventure.gauge" />
          )}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('v2.adventure.mapButton')} onPress={onMap} style={styles.mapBtn} testID="v2-adventure-map">
          <MapIcon size={22} color={v2Colors.primary} />
        </Pressable>
      </View>

      {adventure.state === 'away' ? (
        <>
          <View style={styles.path} accessibilityRole="progressbar" accessibilityLabel={t('v2.adventure.pathLabel', { name: pandaName, percent: Math.round(p * 100) })} accessibilityValue={{ min: 0, max: 100, now: Math.round(p * 100) }}>
            <Text style={styles.endpoint} importantForAccessibility="no">{t('v2.adventure.start')}</Text>
            <View style={styles.dots} importantForAccessibility="no-hide-descendants">
              <View style={styles.dotted} />
              <View style={[styles.head2, { left: `${Math.round(p * 100)}%` }]}>
                <Image source={pandaExpressionImage('content', 'small', variant)} style={styles.headImg} resizeMode="contain" />
              </View>
            </View>
            <Text style={styles.endpoint} importantForAccessibility="no">{t('v2.adventure.finish')}</Text>
          </View>
          <Gauge value={adventure.gauge} cost={adventure.cost} labelKey="adventure.gaugeNextLabel" valueKey="adventure.gaugeNext" />
        </>
      ) : null}
      {adventure.state === 'ready_to_go' ? (
        <>
          <Text style={styles.sub}>{t('v2.adventure.ready')}</Text>
          <PrimaryButton label={t('adventure.go')} onPress={onGo} disabled={busy} />
        </>
      ) : null}
      {adventure.state === 'back' ? <PrimaryButton label={t('v2.adventure.open')} onPress={onOpenBag} disabled={busy} /> : null}
    </View>
  );
}

const HEAD = 34;
const styles = StyleSheet.create({
  card: { ...v2Card, gap: v2Spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: v2Spacing.md },
  headText: { flex: 1 },
  title: v2Text.bodyBold,
  sub: v2Text.body,
  mapBtn: { width: V2_TOUCH, height: V2_TOUCH, borderRadius: V2_TOUCH / 2, backgroundColor: v2Colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  gaugeRow: { gap: 6 },
  gaugeText: { ...v2Text.bodyBold, color: v2Colors.energyText },
  track: { height: 12, borderRadius: 6, backgroundColor: v2Colors.track, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 6, backgroundColor: v2Colors.energy },
  path: { flexDirection: 'row', alignItems: 'center', gap: v2Spacing.sm, minHeight: HEAD + 8 },
  endpoint: { ...v2Text.heading, color: v2Colors.energyText, width: 22, textAlign: 'center' },
  dots: { flex: 1, height: HEAD, justifyContent: 'center' },
  dotted: { borderBottomWidth: 3, borderStyle: 'dotted', borderColor: v2Colors.line },
  head2: { position: 'absolute', top: 0, marginLeft: -HEAD / 2, width: HEAD, height: HEAD, borderRadius: HEAD / 2, backgroundColor: v2Colors.card, borderWidth: 2, borderColor: v2Colors.energy, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  headImg: { width: HEAD - 4, height: HEAD - 4 },
  primary: { minHeight: 52, borderRadius: v2Radius.pill, backgroundColor: v2Colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: v2Spacing.xl },
  primaryPressed: { backgroundColor: v2Colors.primaryPressed },
  primaryText: { ...v2Text.heading, color: v2Colors.onPrimary },
  disabled: { opacity: 0.6 },
});
