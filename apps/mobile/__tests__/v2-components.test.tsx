import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Star } from 'lucide-react-native';
import type { AdventureState } from '@/domain/adventure';
import { AdventureCard } from '@/v2/components/AdventureCard';
import { CelebrationCard } from '@/v2/components/CelebrationCard';
import { CheckButton } from '@/v2/components/CheckButton';
import { DayPill } from '@/v2/components/DayPill';
import { GoalRow } from '@/v2/components/GoalRow';
import { GoalSection } from '@/v2/components/GoalSection';
import { PandaSprite } from '@/v2/components/PandaSprite';
import { SceneHeader } from '@/v2/components/SceneHeader';
import { TAB_STICKERS, TabSticker } from '@/v2/components/TabSticker';
import { V2TabBar, type V2Tab } from '@/v2/components/V2TabBar';
import { v2Colors } from '@/v2/theme';
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
  it('jauge pleine (D-107) : « Chọn nơi đến » ouvre l’onglet Phiêu lưu', async () => {
    const onGo = jest.fn();
    await render(<AdventureCard adventure={adv({ gauge: 60, state: 'ready_to_go' })} pandaName="Bambou" onMap={jest.fn()} onGo={onGo} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Chọn nơi đến' }));
    expect(onGo).toHaveBeenCalled();
  });
  it('en voyage (D-107) : « {name} đang ở {destination} · về sáng mai », chemin ⚡ → ? selon l’avancée, « Chuyến tiếp theo đang chờ! » avec la barre', async () => {
    const active = { id: 'a', destination: 'ha-long', departedOn: '2026-11-01', returnsOn: '2026-11-02' };
    await render(<AdventureCard adventure={adv({ state: 'away', gauge: 5, active })} pandaName="Bambou" progress={0.42} onMap={jest.fn()} reactionEnergy={10} />);
    expect(screen.getByText('Bambou đang ở Vịnh Hạ Long · về sáng mai')).toBeTruthy();
    expect(screen.getByLabelText('Bambou đang trên đường, đã đi 42%')).toBeTruthy();
    expect(screen.getByText('Chuyến tiếp theo đang chờ!')).toBeTruthy();
    expect(screen.queryByText(/Chuyến sau|5\/60/)).toBeNull();
    expect(screen.getByLabelText('Chuyến tiếp theo đang chờ! 5 trên 60 năng lượng').props.accessibilityValue).toMatchObject({ now: 5, max: 60 });
    expect(screen.getByText('+10 ⚡')).toBeTruthy(); // coche pendant le voyage : sur la jauge
  });
  it('retour : « Mở quà »', async () => {
    const onOpenBag = jest.fn();
    await render(<AdventureCard adventure={adv({ state: 'back' })} pandaName="Bambou" onMap={jest.fn()} onOpenBag={onOpenBag} />);
    expect(screen.getByText('Bambou về rồi! Mở quà xem nào')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Mở quà' }));
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
          { key: 'home', label: 'Hôm nay', sticker: 'home', active: true, onPress: jest.fn() },
          { key: 'adventure', label: 'Phiêu lưu', sticker: 'adventure', active: false, onPress, badge: 1 },
        ]}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Hôm nay' }).props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(screen.getByRole('tab', { name: 'Phiêu lưu, có 1 điều mới' }));
    expect(onPress).toHaveBeenCalled();
    // style « autocollant » : icône dessinée, carré clair derrière l'onglet actif seulement, pastille numérotée
    expect(screen.getByTestId('v2-tab-sticker-home', { includeHiddenElements: true })).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('v2-tab-home-tile').props.style).backgroundColor).toBe(v2Colors.tabActiveBg);
    expect(StyleSheet.flatten(screen.getByTestId('v2-tab-adventure-tile').props.style).backgroundColor).toBeUndefined();
    expect(screen.getByText('1', { includeHiddenElements: true })).toBeTruthy();
  });
  it('pastille : « 9+ » au-delà de 9', async () => {
    await render(<V2TabBar tabs={[{ key: 'home', label: 'Hôm nay', sticker: 'home', active: true, onPress: jest.fn(), badge: 12 }]} />);
    expect(screen.getByText('9+', { includeHiddenElements: true })).toBeTruthy();
  });
  it.each(TAB_STICKERS)('icône « autocollant » %s : dessinée', async (name) => {
    await render(<TabSticker name={name} />);
    expect(screen.getByTestId(`v2-tab-sticker-${name}`, { includeHiddenElements: true })).toBeTruthy();
  });
  it('onglets sur le sable de la vidéo d’accueil : couleur du fond, sans coins arrondis, teintes foncées', async () => {
    const tabs: V2Tab[] = [
      { key: 'home', label: 'Hôm nay', sticker: 'home', active: true, onPress: jest.fn() },
      { key: 'adventure', label: 'Phiêu lưu', sticker: 'adventure', active: false, onPress: jest.fn() },
    ];
    const { rerender } = await render(<V2TabBar tabs={tabs} sceneColor="#F7D495" />);
    expect(StyleSheet.flatten(screen.getByTestId('v2-tabbar').props.style)).toMatchObject({ backgroundColor: '#F7D495', borderTopLeftRadius: 0, borderTopRightRadius: 0 });
    expect(StyleSheet.flatten(screen.getByText('Hôm nay').props.style).color).toBe(v2Colors.tabActiveOnScene);
    expect(StyleSheet.flatten(screen.getByText('Phiêu lưu').props.style).color).toBe(v2Colors.tabInactiveOnScene);
    expect(StyleSheet.flatten(screen.getByTestId('v2-tab-home-tile').props.style).backgroundColor).toBe(v2Colors.tabActiveBgOnScene);
    await rerender(<V2TabBar tabs={tabs} />);
    expect(StyleSheet.flatten(screen.getByTestId('v2-tabbar').props.style)).toMatchObject({ backgroundColor: v2Colors.tabBar, borderTopLeftRadius: 24 });
    expect(StyleSheet.flatten(screen.getByText('Hôm nay').props.style).color).toBe(v2Colors.tabActive);
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
