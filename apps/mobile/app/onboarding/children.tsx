import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { createChild } from '@/api/family';
import { queryKeys } from '@/api/keys';
import { ChildAccountSection } from '@/components/ChildAccountSection';
import { CHILD_PALETTE as PALETTE, ChildProfileFields, isChildProfileValid } from '@/components/ChildProfileFields';
import { Button, Card, ErrorText, Screen, Subtitle, Title } from '@/components/ui';
import { ageFromBirthDate } from '@/domain/age';
import { useMe } from '@/hooks/useMe';
import { typography } from '@/theme/tokens';

export default function ChildrenScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useMe();
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [color, setColor] = useState<string>(PALETTE[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = format(new Date(), 'yyyy-MM-dd');

  if (me.data && me.data.member.role !== 'parent') return <Redirect href="/" />;
  const children = me.data?.children ?? [];

  const add = async () => {
    if (!me.data) return;
    setBusy(true);
    setError(null);
    try {
      const index = children.length;
      await createChild(me.data.family.id, {
        name: name.trim(),
        birthDate,
        color,
        label: index === 0 ? t('onboarding.children.labelFirst') : t('onboarding.children.labelNext'),
        sortOrder: index,
      });
      setName('');
      setBirthDate('');
      setColor(PALETTE[(index + 1) % PALETTE.length] ?? PALETTE[0]);
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
    } catch {
      setError(t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const formValid = isChildProfileValid(name, birthDate, today);

  return (
    <Screen>
      <Title>{t('onboarding.children.title')}</Title>
      <Subtitle>{t('onboarding.children.subtitle')}</Subtitle>

      {children.map((child) => {
        return (
          <Card key={child.id}>
            <Text style={typography.title}>{child.name}</Text>
            <Text style={typography.secondary}>
              {t('common.yearsOld', { age: ageFromBirthDate(child.birth_date, today) })}
            </Text>
            <ChildAccountSection childId={child.id} childName={child.name} />
          </Card>
        );
      })}

      <Card>
        <ChildProfileFields name={name} onName={setName} birthDate={birthDate} onBirthDate={setBirthDate} color={color} onColor={setColor} today={today} />
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
