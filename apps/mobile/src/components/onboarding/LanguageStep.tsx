import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { syncPushLocale } from '@/api/notifications';
import { Chip } from '@/components/Chip';
import { useStepNav } from '@/components/onboarding/useStepNav';
import { ThemeCard } from '@/components/ThemeCard';
import { WizardShell } from '@/components/onboarding/WizardShell';
import { Card, ErrorText, Field } from '@/components/ui';
import { detectLanguage, suggestTimeZone, type OnboardingFacts } from '@/domain/onboarding';
import { isValidTimeZone } from '@/domain/timezone';
import { useUpdateFamilyProfile } from '@/hooks/useFamilyAdmin';
import { useMe } from '@/hooks/useMe';
import { useOnboardingStep } from '@/hooks/useOnboarding';
import { SUPPORTED_LANGUAGES, type Language } from '@/i18n';
import { setLanguage, storedLanguage } from '@/i18n/language';
import { colors, typography } from '@/theme/tokens';

const deviceTimeZone = (): string | undefined => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
};
const browserLanguage = (): string | undefined => (typeof navigator === 'undefined' ? undefined : navigator.language);

/**
 * Étape 1 — langue et famille. Tout est PRÉREMPLI (langue du navigateur sinon vietnamien, fuseau de l'appareil, nom saisi à la création) ; le parent
 * confirme d'un geste : c'est le seul état « fait » qui est un drapeau explicite (côté serveur).
 */
export function LanguageStep({ facts }: { facts: OnboardingFacts }) {
  const { t, i18n } = useTranslation();
  const me = useMe().data;
  const nav = useStepNav('language', facts);
  const confirm = useOnboardingStep();
  const updateProfile = useUpdateFamilyProfile();
  const [name, setName] = useState(me?.family.name ?? '');
  const [tz, setTz] = useState(() => suggestTimeZone(deviceTimeZone(), me?.family.timezone ?? 'Asia/Ho_Chi_Minh'));
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<Language>(() => storedLanguage() ?? detectLanguage(browserLanguage()));
  if (!me) return null;

  const tzValid = isValidTimeZone(tz);
  const nameValid = name.trim() !== '';
  const choose = (l: Language) => {
    setLang(l);
    void setLanguage(l).then(syncPushLocale);
  };

  const next = async () => {
    setError(null);
    try {
      // la langue préremplie devient celle de l'appareil dès la confirmation
      if (i18n.language !== lang) await setLanguage(lang);
      if (name.trim() !== me.family.name || tz !== me.family.timezone) await updateProfile.mutateAsync({ familyId: me.family.id, name: name.trim(), timezone: tz });
      await confirm.mutateAsync({ step: 'language', action: 'confirm' });
      void syncPushLocale();
      nav.goNext();
    } catch {
      setError(t('common.error'));
    }
  };

  return (
    <WizardShell
      number={nav.number}
      total={nav.total}
      title={t('onboarding.language.title')}
      subtitle={t('onboarding.language.subtitle')}
      onNext={() => void next()}
      nextDisabled={!tzValid || !nameValid}
      nextLoading={confirm.isPending || updateProfile.isPending}
      onSkip={nav.skip ? () => void nav.skip?.() : undefined}
      skipLoading={nav.skipping}
      onBack={nav.goBack}
    >
      <Card>
        <Text accessibilityRole="header" style={styles.section}>{t('settings.language')}</Text>
        <View style={styles.wrap}>
          {SUPPORTED_LANGUAGES.map((l) => (
            <Chip key={l} label={t(`settings.lang.${l}`)} selected={lang === l} onPress={() => choose(l)} />
          ))}
        </View>
      </Card>
      {/* apparence : réglage PAR APPAREIL (comme la langue) ; sur le web le choix recharge l'app, l'assistant reprend à cette étape */}
      <ThemeCard />
      <Text style={typography.secondary}>{t('onboarding.language.themeHint')}</Text>
      <Card>
        <Field label={t('onboarding.language.familyName')} value={name} onChangeText={setName} maxLength={80} error={nameValid ? null : t('onboarding.family.required')} />
        <Field label={t('settings.timezone')} value={tz} onChangeText={setTz} autoCapitalize="none" autoCorrect={false} error={tzValid ? null : t('settings.timezoneInvalid')} />
        <Text style={typography.secondary}>{t('onboarding.language.timezoneHint')}</Text>
      </Card>
      <ErrorText>{error}</ErrorText>
    </WizardShell>
  );
}

const styles = StyleSheet.create({
  section: { ...typography.title, color: colors.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
