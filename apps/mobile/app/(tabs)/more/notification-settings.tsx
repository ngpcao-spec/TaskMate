import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Button, Card, Field, Screen, Title } from '@/components/ui';
import { DEFAULT_PREFS, isValidTime, MAX_REMINDER_MIN, type NotificationPrefs } from '@/domain/notification-prefs';
import { useMe } from '@/hooks/useMe';
import { useNotificationPrefs, useSavePrefs } from '@/hooks/useNotifications';
import { colors, MIN_TARGET, typography } from '@/theme/tokens';

/** Cài đặt thông báo (SPEC §3.9) : rappels (enfant), récap du soir, activité des enfants (parent). */
export default function NotificationSettingsScreen() {
  const { data: stored } = useNotificationPrefs();
  if (!stored) return null;
  // `key` : le formulaire repart des valeurs relues du serveur
  return <PrefsForm key={JSON.stringify(stored)} initial={stored} />;
}

function PrefsForm({ initial }: { initial: NotificationPrefs }) {
  const { t } = useTranslation();
  const isParent = useMe().data?.member.role === 'parent';
  const save = useSavePrefs();
  const [prefs, setPrefs] = useState<NotificationPrefs>(initial);
  const [startText, setStartText] = useState(initial.reminderBeforeStartMin === null ? '' : String(initial.reminderBeforeStartMin));
  const [deadlineText, setDeadlineText] = useState(initial.reminderBeforeDeadlineMin === null ? '' : String(initial.reminderBeforeDeadlineMin));
  const [timeText, setTimeText] = useState(initial.eveningRecap.time);

  const minutes = (text: string): number | null | 'invalid' => {
    if (text.trim() === '') return null;
    const n = Number(text);
    return Number.isInteger(n) && n >= 0 && n <= MAX_REMINDER_MIN ? n : 'invalid';
  };
  const start = minutes(startText);
  const deadline = minutes(deadlineText);
  const timeValid = isValidTime(timeText);
  const valid = start !== 'invalid' && deadline !== 'invalid' && timeValid;

  const submit = () => {
    if (!valid) return;
    save.mutate({
      ...prefs,
      reminderBeforeStartMin: start as number | null,
      reminderBeforeDeadlineMin: deadline as number | null,
      eveningRecap: { ...prefs.eveningRecap, time: timeText },
    });
  };

  return (
    <Screen>
      <Title>{t('notifSettings.title')}</Title>
      {isParent ? null : (
        <Card>
          <Field label={t('notifSettings.beforeStart')} placeholder={t('notifSettings.off')} value={startText} onChangeText={(v) => setStartText(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={3} />
          <Field label={t('notifSettings.beforeDeadline')} placeholder={t('notifSettings.off')} value={deadlineText} onChangeText={(v) => setDeadlineText(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={3} />
        </Card>
      )}
      <Card>
        <ToggleRow label={t('notifSettings.recap')} value={prefs.eveningRecap.enabled} onChange={(enabled) => setPrefs({ ...prefs, eveningRecap: { ...prefs.eveningRecap, enabled } })} />
        {prefs.eveningRecap.enabled ? (
          <Field label={t('notifSettings.recapTime')} value={timeText} onChangeText={setTimeText} placeholder="20:30" maxLength={5} error={timeValid ? null : t('notifSettings.invalidTime')} />
        ) : null}
      </Card>
      {isParent ? (
        <Card>
          <Text accessibilityRole="header" style={styles.section}>{t('notifSettings.activityTitle')}</Text>
          <ToggleRow label={t('notifSettings.taskDone')} value={prefs.activity.taskDone} onChange={(taskDone) => setPrefs({ ...prefs, activity: { ...prefs.activity, taskDone } })} />
          <ToggleRow label={t('notifSettings.rewardRequested')} value={prefs.activity.rewardRequested} onChange={(rewardRequested) => setPrefs({ ...prefs, activity: { ...prefs.activity, rewardRequested } })} />
          <ToggleRow label={t('notifSettings.goalAchieved')} value={prefs.activity.goalAchieved} onChange={(goalAchieved) => setPrefs({ ...prefs, activity: { ...prefs.activity, goalAchieved } })} />
        </Card>
      ) : null}
      <Button label={t('common.save')} onPress={submit} disabled={!valid} loading={save.isPending} />
      <Button variant="ghost" label={t('notifSettings.reset')} onPress={() => { setPrefs(DEFAULT_PREFS); setStartText('10'); setDeadlineText('30'); setTimeText('20:30'); }} />
    </Screen>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={[typography.body, styles.flex, { color: colors.text }]}>{label}</Text>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: MIN_TARGET },
  section: { ...typography.title, color: colors.text },
});
