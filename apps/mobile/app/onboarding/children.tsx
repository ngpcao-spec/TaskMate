import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { createChild, createInvite } from '@/api/family';
import { queryKeys } from '@/api/keys';
import { InviteCard } from '@/components/InviteCard';
import { Button, Card, ErrorText, Field, Screen, Subtitle, Title } from '@/components/ui';
import { ageFromBirthDate } from '@/domain/age';
import { validateBirthDate } from '@/domain/birth-date';
import { useMe } from '@/hooks/useMe';
import { colors, MIN_TARGET, typography } from '@/theme/tokens';

const PALETTE = [colors.primary, colors.mint, '#8B5CF6', '#F5A623', '#E5484D'] as const;

export default function ChildrenScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useMe();
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [color, setColor] = useState<string>(PALETTE[0]);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = format(new Date(), 'yyyy-MM-dd');
  const birthError = birthDate === '' ? null : validateBirthDate(birthDate, today);

  if (me.data && me.data.member.role !== 'parent') return <Redirect href="/" />;
  const children = me.data?.children ?? [];

  const add = async () => {
    if (!me.data) return;
    setBusy(true);
    setError(null);
    try {
      const index = children.length;
      const child = await createChild(me.data.family.id, {
        name: name.trim(),
        birthDate,
        color,
        label: index === 0 ? t('onboarding.children.labelFirst') : t('onboarding.children.labelNext'),
        sortOrder: index,
      });
      setCodes((c) => ({ ...c, [child.id]: '' }));
      setName('');
      setBirthDate('');
      setColor(PALETTE[(index + 1) % PALETTE.length] ?? PALETTE[0]);
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
      setCodes((c) => ({ ...c, [child.id]: '' }));
      const code = await createInvite(child.id);
      setCodes((c) => ({ ...c, [child.id]: code }));
    } catch {
      setError(t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async (childId: string) => {
    try {
      const code = await createInvite(childId);
      setCodes((c) => ({ ...c, [childId]: code }));
    } catch {
      setError(t('common.error'));
    }
  };

  const formValid = name.trim() !== '' && birthDate !== '' && birthError === null;

  return (
    <Screen>
      <Title>{t('onboarding.children.title')}</Title>
      <Subtitle>{t('onboarding.children.subtitle')}</Subtitle>

      {children.map((child) => {
        const code = codes[child.id];
        return (
          <Card key={child.id}>
            <Text style={typography.title}>{child.name}</Text>
            <Text style={typography.secondary}>
              {t('common.yearsOld', { age: ageFromBirthDate(child.birth_date, today) })}
            </Text>
            <InviteCard
              code={code || null}
              hint={t('onboarding.children.inviteHint', { name: child.name })}
              actionLabel={code ? t('onboarding.children.regenerate') : t('onboarding.children.inviteCode')}
              onGenerate={() => regenerate(child.id)}
            />
          </Card>
        );
      })}

      <Card>
        <Field
          label={t('onboarding.children.name')}
          value={name}
          onChangeText={setName}
          maxLength={40}
        />
        <Field
          label={t('onboarding.children.birthDate')}
          placeholder="2012-05-01"
          value={birthDate}
          onChangeText={setBirthDate}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
          error={birthError ? t(`onboarding.children.errors.${birthError}`) : null}
        />
        <Text style={typography.secondary}>{t('onboarding.children.color')}</Text>
        <View style={styles.palette}>
          {PALETTE.map((c) => (
            <Pressable
              key={c}
              accessibilityRole="radio"
              accessibilityLabel={`${t('onboarding.children.color')} ${c}`}
              accessibilityState={{ selected: color === c }}
              onPress={() => setColor(c)}
              style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchSelected]}
            />
          ))}
        </View>
        <ErrorText>{error}</ErrorText>
        <Button label={t('onboarding.children.add')} onPress={add} loading={busy} disabled={!formValid || !me.data} />
      </Card>

      <Button
        label={t('onboarding.children.finish')}
        onPress={() => router.replace('/')}
        disabled={children.length === 0}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  palette: { flexDirection: 'row', gap: 12 },
  swatch: { width: MIN_TARGET, height: MIN_TARGET, borderRadius: MIN_TARGET / 2, borderWidth: 3, borderColor: 'transparent' },
  swatchSelected: { borderColor: colors.text },
});
