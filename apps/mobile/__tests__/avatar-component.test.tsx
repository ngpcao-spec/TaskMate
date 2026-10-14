import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';
import '@/i18n';
import { Avatar } from '@/components/Avatar';
import { createTestQueryClient } from '../test-utils/queryClient';

let mockAvatars: Record<string, { allowed: boolean; uri: string | null; version: number }> = {};
jest.mock('@/api/avatars', () => ({ fetchAvatars: async () => mockAvatars }));

const renderAvatar = async (ui: React.ReactElement) => {
  const client = createTestQueryClient();
  await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

describe('Avatar (D-071)', () => {
  beforeEach(() => { mockAvatars = {}; });

  it('sans avatar : l’initiale du prénom, et le prénom pour les lecteurs d’écran', async () => {
    await renderAvatar(<Avatar childId="c1" name="Minh" color="#1E88F5" />);
    expect(screen.getByText('M')).toBeTruthy();
    expect(screen.getByLabelText('Minh')).toBeTruthy();
    expect(screen.queryByTestId('avatar-image')).toBeNull();
  });

  it('avec avatar : l’image du dessin remplace l’initiale', async () => {
    mockAvatars = { c1: { allowed: true, uri: 'data:image/webp;base64,UklGRg==', version: 1 } };
    await renderAvatar(<Avatar childId="c1" name="Minh" />);
    await waitFor(() => expect(screen.getByTestId('avatar-image').props.source).toEqual({ uri: 'data:image/webp;base64,UklGRg==' }));
    expect(screen.queryByText('M')).toBeNull();
    expect(screen.getByLabelText('Minh')).toBeTruthy();
  });

  it('l’avatar d’un enfant ne s’affiche jamais pour un autre', async () => {
    mockAvatars = { c1: { allowed: true, uri: 'data:image/webp;base64,UklGRg==', version: 1 } };
    await renderAvatar(<Avatar childId="c2" name="Khang" />);
    expect(screen.getByText('K')).toBeTruthy();
    expect(screen.queryByTestId('avatar-image')).toBeNull();
  });

  it('sans identifiant d’enfant (un parent) : simple initiale, libellé personnalisable', async () => {
    await renderAvatar(<Avatar name="Ba" accessibilityLabel="Mon profil" size={40} />);
    expect(screen.getByText('B')).toBeTruthy();
    expect(screen.getByLabelText('Mon profil')).toBeTruthy();
  });
});
