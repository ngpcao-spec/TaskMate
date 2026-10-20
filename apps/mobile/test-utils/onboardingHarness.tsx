import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { createTestQueryClient } from './queryClient';
import type { OnboardingChild, OnboardingFacts } from '@/domain/onboarding';

/** Faits de départ des tests de l'assistant (D-090) : famille neuve, parent propriétaire. */
export const kid = (over: Partial<OnboardingChild> = {}): OnboardingChild => ({ id: 'c1', name: 'Minh', country: 'VN', grade: '7', subjects: ['maths'], available: ['maths', 'hist_geo'], ...over });
export const facts = (over: Partial<OnboardingFacts> = {}): OnboardingFacts => ({
  isOwner: true, languageConfirmed: false, skipped: [], cardHidden: false, children: [], tasks: 0, rewards: 0, parents: 1, inviteActive: false, deviceActive: false, ...over,
});

const clients: QueryClient[] = [];
export async function renderWithClient(ui: ReactElement) {
  const client = createTestQueryClient();
  clients.push(client);
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}
export const clearClients = () => clients.splice(0).forEach((c) => c.clear());
