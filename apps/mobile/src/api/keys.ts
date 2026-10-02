export const queryKeys = {
  me: ['me'] as const,
  children: (familyId: string) => ['children', familyId] as const,
};
