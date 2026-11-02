import { fireEvent, render, screen } from '@testing-library/react-native';
import { House, Star } from 'lucide-react-native';
import type { AdventureState } from '@/domain/adventure';
import { AdventureCard } from '@/v2/components/AdventureCard';
import { CelebrationCard } from '@/v2/components/CelebrationCard';
import { CheckButton } from '@/v2/components/CheckButton';
import { DayPill } from '@/v2/components/DayPill';
import { GoalRow } from '@/v2/components/GoalRow';
import { GoalSection } from '@/v2/components/GoalSection';
import { PandaSprite } from '@/v2/components/PandaSprite';
import { SceneHeader } from '@/v2/components/SceneHeader';
import { V2TabBar } from '@/v2/components/V2TabBar';
import '@/i18n';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const adv = (over: Partial<AdventureState> = {}): AdventureState => ({
  gauge: 18, cost: 60, state: 'filling', level: 1, today: '2026-11-02', active: null, last: null, unlocked: ['ha-long'],
  destinations: [{ slug: 'ha-long', minLevel: 1, discoveries: [] }], found: [], foundCount: 0, totalCount: 30, ...over,
});

describe('V2 : CheckButton et GoalRow', () => {
  it('case ronde : rôle checkbox, état, libellé = titre', async () => {
    const onPress = jest.fn();
    await render(<CheckButton checked={false} label="Đánh răng" onPress={onPress} />);
    const box = screen.getByRole('checkbox', { name: 'Đánh răng' });
    expect(box.props.accessibilityState).toMatchObject({ checked: false });
    await fireEvent.press(box);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  it('ligne : icône, titre, « 10 ⚡ », mention en attente, bouton ✓', async () => {
    const onToggle = jest.fn();
    await render(<GoalRow icon="brosse-a-dents" title="Đánh răng" energy={10} checked pending onToggle={onToggle} />);
    expect(screen.getByText('Đánh răng')).toBeTruthy();
    expect(screen.getByLabelText('10 năng lượng')).toBeTruthy();
    expect(screen.getByText('chờ bố mẹ duyệt')).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Đánh răng' }));
    expect(onToggle).toHaveBeenCalled();
  });
  it('ligne d’information (révision) : pas de case, ouverture au toucher', async () => {
    const onOpen = jest.fn();
    await render(<GoalRow icon="devoirs" title="Ôn tập tuần" energy={null} checked={false} onOpen={onOpen} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Xem: Ôn tập tuần' }));
    expect(onOpen).toHaveBeenCalled();
  });
});

describe('V2 : GoalSection et DayPill', () => {
  it('section repliable', async () => {
    await render(
      <GoalSection section="morning" count={2}>
        <GoalRow icon="reveil" title="Dậy sớm" energy={5} checked={false} onToggle={() => undefined} />
      </GoalSection>,
    );
    const header = screen.getByRole('button', { name: 'Buổi sáng, 2 việc' });
    expect(header.props.accessibilityState).toMatchObject({ expanded: true });
    expect(screen.getByText('Dậy sớm')).toBeTruthy();
    await fireEvent.press(header);
    expect(screen.queryByText('Dậy sớm')).toBeNull();
  });
  it('pastille du jour', async () => {
    const { rerender } = await render(<DayPill remaining={3} total={5} />);
    expect(screen.getByText('Còn 3 việc hôm nay!')).toBeTruthy();
    await rerender(<DayPill remaining={0} total={5} />);
    expect(screen.getByText('Hôm nay: 5/5 việc ✓')).toBeTruthy();
    await rerender(<DayPill remaining={0} total={0} />);
    expect(screen.queryByText(/hôm nay/)).toBeNull();
  });
});

describe('V2 : AdventureCard', () => {
  it('jauge « Phiêu lưu 18/60 » ⚡ et bouton carte', async () => {
    const onMap = jest.fn();
    await render(<AdventureCard adventure={adv()} pandaName="Bambou" onMap={onMap} />);
    expect(screen.getByLabelText('Phiêu lưu: 18 trên 60 năng lượng')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Bản đồ phiêu lưu' }));
    expect(onMap).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Đi phiêu lưu!' })).toBeNull();
  });
  it('jauge pleine : départ', async () => {
    const onGo = jest.fn();
    await render(<AdventureCard adventure={adv({ gauge: 60, state: 'ready_to_go' })} pandaName="Bambou" onMap={jest.fn()} onGo={onGo} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Đi phiêu lưu!' }));
    expect(onGo).toHaveBeenCalled();
  });
  it('en voyage : message, chemin ⚡ → ? selon l’avancée, jauge suivante', async () => {
    const active = { id: 'a', destination: 'ha-long', departedOn: '2026-11-01', returnsOn: '2026-11-02' };
    await render(<AdventureCard adventure={adv({ state: 'away', gauge: 5, active })} pandaName="Bambou" progress={0.42} onMap={jest.fn()} />);
    expect(screen.getByText('Đang phiêu lưu · về sáng mai')).toBeTruthy();
    expect(screen.getByLabelText('Bambou đang trên đường, đã đi 42%')).toBeTruthy();
    expect(screen.getByLabelText('Chuyến sau: 5 trên 60 năng lượng')).toBeTruthy();
  });
  it('retour : ouvrir le sac', async () => {
    const onOpenBag = jest.fn();
    await render(<AdventureCard adventure={adv({ state: 'back' })} pandaName="Bambou" onMap={jest.fn()} onOpenBag={onOpenBag} />);
    expect(screen.getByText('Bambou về rồi! Mở túi xem nào')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Mở túi' }));
    expect(onOpenBag).toHaveBeenCalled();
  });
});

describe('V2 : CelebrationCard', () => {
  it('visage fier, voix du stade, départ si la jauge est pleine, « Xem lại »', async () => {
    const onGo = jest.fn();
    const onReview = jest.fn();
    await render(<CelebrationCard stage={2} pandaName="Bambou" action={{ kind: 'go' }} onGo={onGo} onReview={onReview} />);
    expect(screen.getByText('Xong hết rồi!')).toBeTruthy();
    expect(screen.queryByText('Mục tiêu hôm nay hoàn thành')).toBeNull(); // plus de ligne en double sous le titre
    expect(screen.getByText('Giỏi quá! Tụi mình hoàn thành mục tiêu hôm nay rồi!')).toBeTruthy();
    expect(screen.getByLabelText('Panda Bambou, tự hào')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Đi phiêu lưu!' }));
    expect(onGo).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('link', { name: 'Xem lại' }));
    expect(onReview).toHaveBeenCalled();
  });
  it('jauge incomplète : l’énergie qui manque, pas de départ', async () => {
    await render(<CelebrationCard stage={4} pandaName="Bambou" action={{ kind: 'missing', energy: 18 }} onReview={jest.fn()} />);
    expect(screen.getByText('Còn 18 ⚡ nữa là đi được!')).toBeTruthy();
    expect(screen.getByText('Tốt lắm. Mục tiêu hôm nay đã hoàn thành.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Đi phiêu lưu!' })).toBeNull();
  });
});

describe('V2 : barre d’onglets, en-tête, panda', () => {
  it('onglets : sélection, pastille', async () => {
    const onPress = jest.fn();
    await render(
      <V2TabBar
        tabs={[
          { key: 'home', label: 'Hôm nay', Icon: House, active: true, onPress: jest.fn() },
          { key: 'adventure', label: 'Phiêu lưu', Icon: Star, active: false, onPress, badge: 1 },
        ]}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Hôm nay' }).props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(screen.getByRole('tab', { name: 'Phiêu lưu, có 1 điều mới' }));
    expect(onPress).toHaveBeenCalled();
  });
  it('en-tête : décor, boutons du haut (≥ 44 pt) avec libellé', async () => {
    const onPress = jest.fn();
    await render(<SceneHeader scene="ha-long" height={300} right={[{ key: 'bell', Icon: Star, label: 'Thông báo', onPress, badge: 2 }]} />);
    expect(screen.getByTestId('v2-scene-ha-long')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Thông báo (2)' }));
    expect(onPress).toHaveBeenCalled();
  });
  it('panda : pose, expression, marche pendant une aventure', async () => {
    const { rerender } = await render(<PandaSprite stage={2} name="Bambou" size={120} />);
    expect(screen.getByLabelText('Panda Bambou, bình tĩnh')).toBeTruthy();
    await rerender(<PandaSprite stage={2} name="Bambou" size={120} expression="surpris" />);
    expect(screen.getByLabelText('Panda Bambou, ngạc nhiên')).toBeTruthy();
    await rerender(<PandaSprite stage={2} name="Bambou" size={120} walking />);
    expect(screen.getByLabelText('Panda Bambou đang đi phiêu lưu')).toBeTruthy();
  });
});
