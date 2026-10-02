import { fireEvent, render, screen } from '@testing-library/react-native';
import { Share } from 'react-native';
import '@/i18n';
import { InviteCard } from '@/components/InviteCard';

jest.mock('react-native-qrcode-svg', () => 'MockQRCode');

describe('InviteCard — lien partageable', () => {
  it('affiche code, lien et bouton de partage ; le lien relit le même code', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    await render(<InviteCard code="ABC234" hint="astuce" actionLabel="Tạo mã mới" onGenerate={jest.fn()} />);
    expect(screen.getByLabelText('Mã mời ABC234')).toBeTruthy();
    expect(screen.getByText('taskmate://join?code=ABC234')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Chia sẻ liên kết' }));
    expect(share).toHaveBeenCalledWith({ message: 'taskmate://join?code=ABC234' });
  });

  it('sans code : seulement le bouton de génération', async () => {
    await render(<InviteCard code={null} hint="astuce" actionLabel="Tạo mã mới" onGenerate={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'Chia sẻ liên kết' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Tạo mã mới' })).toBeTruthy();
  });
});
