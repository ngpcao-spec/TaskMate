import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, MIN_TARGET, typography } from '@/theme/tokens';

type Props = { label: string; mode: 'date' | 'time'; value: string; onChange: (value: string) => void; error?: string | null };

const pad = (n: number) => String(n).padStart(2, '0');

function toDate(mode: 'date' | 'time', value: string): Date {
  if (mode === 'time') {
    const [h, m] = value.split(':').map(Number);
    return new Date(2000, 0, 1, h || 0, m || 0);
  }
  const [y, mo, d] = value.split('-').map(Number);
  return new Date(y || 2000, (mo || 1) - 1, d || 1);
}

function fromDate(mode: 'date' | 'time', d: Date): string {
  return mode === 'time' ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Sélecteur natif de date / heure (compact sur iOS, boîte de dialogue sur Android). */
export function PickerField({ label, mode, value, onChange, error }: Props) {
  const [open, setOpen] = useState(false);
  const handle = (event: DateTimePickerEvent, date?: Date) => {
    setOpen(false);
    if (event.type === 'set' && date) onChange(fromDate(mode, date));
  };
  return (
    <View style={styles.wrap}>
      <Text style={typography.secondary}>{label}</Text>
      {Platform.OS === 'ios' ? (
        <View style={styles.iosRow}>
          {mode === 'time' ? (
            <DateTimePicker accessibilityLabel={label} value={toDate(mode, value)} mode="time" display="compact" onChange={handle} />
          ) : (
            <DateTimePicker accessibilityLabel={label} value={toDate(mode, value)} mode="date" display="compact" onChange={handle} />
          )}
        </View>
      ) : (
        <>
          <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={() => setOpen(true)} style={styles.button}>
            <Text style={styles.value}>{value}</Text>
          </Pressable>
          {open && mode === 'time' ? <DateTimePicker value={toDate(mode, value)} mode="time" is24Hour onChange={handle} /> : null}
          {open && mode === 'date' ? <DateTimePicker value={toDate(mode, value)} mode="date" onChange={handle} /> : null}
        </>
      )}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4, flex: 1 },
  iosRow: { minHeight: MIN_TARGET, alignItems: 'flex-start', justifyContent: 'center' },
  button: { minHeight: MIN_TARGET, borderRadius: 12, borderWidth: 1, borderColor: '#DDE5F0', backgroundColor: colors.card, justifyContent: 'center', paddingHorizontal: 16 },
  value: { fontSize: 16, color: colors.text },
  error: { color: colors.danger, fontSize: 13 },
});
