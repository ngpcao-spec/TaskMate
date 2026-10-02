import jsQR from 'jsqr';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { ErrorText } from '@/components/ui';
import { colors, radius, typography } from '@/theme/tokens';

type Props = { onScan: (data: string) => void };

/**
 * Scanner QR web : caméra du navigateur (getUserMedia) + décodage jsQR sur un canvas.
 * jsQR plutôt que BarcodeDetector (absent de Firefox et de Safari). Si la caméra est refusée ou absente,
 * on affiche un message : l'écran de jointure garde toujours la saisie manuelle du code.
 */
export function QrScanner({ onScan }: Props) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [denied, setDenied] = useState(() => typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia);
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let raf = 0;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tick = () => {
      const video = videoRef.current;
      if (stopped || !video || !ctx) return;
      if (video.readyState >= 2 && video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const found = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
        if (found?.data) {
          onScanRef.current(found.data);
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        if (stopped) {
          s.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = s;
        const video = videoRef.current;
        if (video) {
          video.srcObject = s;
          void video.play().catch(() => undefined);
        }
        raf = requestAnimationFrame(tick);
      })
      .catch(() => setDenied(true));

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  if (denied) return <ErrorText>{t('onboarding.join.cameraDenied')}</ErrorText>;
  return (
    <View style={styles.flex}>
      <video ref={videoRef} playsInline muted aria-label={t('onboarding.join.scan')} style={videoStyle} />
      <Text style={[typography.secondary, styles.hint]}>{t('onboarding.join.scanning')}</Text>
    </View>
  );
}

const videoStyle = { width: '100%', minHeight: 320, objectFit: 'cover', borderRadius: radius.card, backgroundColor: colors.text } as const;

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 8 },
  hint: { textAlign: 'center' },
});
