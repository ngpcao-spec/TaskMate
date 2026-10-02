export const colors = {
  primary: '#1E88F5',
  mint: '#2EC4A6',
  background: '#F5F8FC',
  card: '#FFFFFF',
  text: '#1A2233',
  textSecondary: '#8A94A6',
  danger: '#E5484D',
  success: '#27AE60',
} as const;

export const radius = { card: 16, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const typography = {
  title: { fontSize: 22, fontWeight: '600' as const },
  body: { fontSize: 15 },
  secondary: { fontSize: 13, color: colors.textSecondary },
};

export const shadow = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
} as const;

/** Minimum touch target (pt). */
export const MIN_TARGET = 44;
