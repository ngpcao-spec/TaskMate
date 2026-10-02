import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Button, ErrorText } from '@/components/ui';
import { colors, radius, typography } from '@/theme/tokens';

type Props = { onScan: (data: string) => void };

/** Scanner QR natif (expo-camera). La version web est dans QrScanner.web.tsx. */
export function QrScanner({ onScan }: Props) {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
  }, [permission, requestPermission]);
  if (!permission?.granted) {
    return (
      <>
        <ErrorText>{t('onboarding.join.cameraDenied')}</ErrorText>
        <Button label={t('common.continue')} onPress={() => void requestPermission()} />
      </>
    );
  }
  return (
    <View style={styles.flex}>
      <CameraView style={styles.camera} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => onScan(data)} />
      <Text style={[typography.secondary, styles.hint]}>{t('onboarding.join.scanning')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 8 },
  camera: { flex: 1, minHeight: 320, borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.text },
  hint: { textAlign: 'center' },
});
