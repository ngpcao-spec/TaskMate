import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { confirmDialog } from '@/components/confirm';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChildAccountSection } from '@/components/ChildAccountSection';
import { Button, Card, Field, Screen, Title } from '@/components/ui';
import { ageFromBirthDate } from '@/domain/age';
import { validateBirthDate } from '@/domain/birth-date';
import { todayInTz } from '@/domain/family-time';
import { useDeleteChild, useUpdateChild } from '@/hooks/useFamilyAdmin';
import { useMe } from '@/hooks/useMe';
import { colors, MIN_TARGET, typography } from '@/theme/tokens';
import type { ChildRow } from '@/types/models';

const PALETTE = [colors.primary, colors.mint, '#8B5CF6', '#F5A623', '#E5484D'] as const;

/** Gestion des enfants (parent) : modifier, supprimer, comptes de connexion (SPEC §3.9). */
export default function ChildrenAdminScreen() {
  const { t } = useTranslation();
  const me = useMe().data;
  if (!me || me.member.role !== 'parent') return null;
  const today = todayInTz(new Date(), me.family.timezone);
  return (
    <Screen>
      <Title>{t('settings.manageChildren')}</Title>
      {me.children.map((c) => (
        <ChildCard key={c.id} child={c} today={today} />
      ))}
    </Screen>
  );
}

function ChildCard({ child, today }: { child: ChildRow; today: string }) {
  const { t } = useTranslation();
  const update = useUpdateChild();
  const remove = useDeleteChild();
  const [name, setName] = useState(child.name);
  const [birth, setBirth] = useState(child.birth_date);
  const [color, setColor] = useState(child.color ?? colors.primary);
  const birthError = validateBirthDate(birth, today);
  const dirty = name.trim() !== child.name || birth !== child.birth_date || color !== child.color;
  const valid = name.trim() !== '' && birthError === null;

  return (
    <Card>
      <Text style={typography.title}>{child.name}</Text>
      <Text style={typography.secondary}>{t('common.yearsOld', { age: ageFromBirthDate(child.birth_date, today) })}</Text>
      <Field label={t('onboarding.children.name')} value={name} onChangeText={setName} maxLength={40} />
      <Field label={t('onboarding.children.birthDate')} value={birth} onChangeText={setBirth} maxLength={10} error={birthError ? t(`onboarding.children.errors.${birthError}`) : null} />
      <View style={styles.palette}>
        {PALETTE.map((c) => (
          <Pressable key={c} accessibilityRole="radio" accessibilityLabel={`${t('onboarding.children.color')} ${c}`} accessibilityState={{ selected: color === c }} aria-checked={color === c} onPress={() => setColor(c)} style={[styles.swatch, { backgroundColor: c }, color === c && styles.selected]} />
        ))}
      </View>
      <Button label={t('common.save')} disabled={!dirty || !valid} loading={update.isPending} onPress={() => update.mutate({ id: child.id, patch: { name: name.trim(), birth_date: birth, color } })} />
      <ChildAccountSection childId={child.id} childName={child.name} />
      <Button
        variant="secondary"
        label={`${t('settings.deleteChild')} ${child.name}`}
        onPress={() =>
          confirmDialog({
            title: t('settings.deleteChild'),
            message: t('settings.deleteChildBody', { name: child.name }),
            confirmLabel: t('settings.deleteChild'),
            cancelLabel: t('common.cancel'),
            destructive: true,
            onConfirm: () => remove.mutate(child.id),
          })
        }
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  palette: { flexDirection: 'row', gap: 12 },
  swatch: { width: MIN_TARGET, height: MIN_TARGET, borderRadius: MIN_TARGET / 2, borderWidth: 3, borderColor: 'transparent' },
  selected: { borderColor: colors.text },
});
