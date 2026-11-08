import { useIsFocused, useRouter } from 'expo-router';
import { Bell, CalendarDays, Menu } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PandaSetupCard } from '@/components/companion/PandaSetupCard';
import { ChildSetupGate } from '@/components/onboarding/ChildSetupGate';
import { awayProgress, RETURN_MORNING } from '@/domain/adventure';
import { coverPoint, WALK_OUT_MS } from '@/domain/adventure-trip';
import { celebrationAction, dayComplete, groupByDaySection, remainingCount } from '@/domain/day-sections';
import { timeInTz, todayInTz } from '@/domain/family-time';
import { goalIconFor, WEEKLY_REVIEW_ICON } from '@/domain/goal-icons';
import { homeMediaMode, homeVideoLayout, pandaHitRect } from '@/domain/home-video';
import { DEFAULT_PANDA_NAME, localHourOf, pandaMood, type PandaMood } from '@/domain/panda';
import { pandaLineKey, pandaLineParams, storySituation } from '@/domain/panda-lines';
import { taskPermissions } from '@/domain/permissions';
import { instantInTz } from '@/domain/reminders';
import { taskState } from '@/domain/task-state';
import { timeLabel } from '@/domain/task-time';
import { bannerModel } from '@/domain/weekly-review';
import { useAdventure, useAdventurePending } from '@/hooks/useAdventure';
import { useCompanion } from '@/hooks/useCompanion';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';
import { useUnreadNotifications } from '@/hooks/useNotifications';
import { useNow } from '@/hooks/useNow';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { prefersSaveData } from '@/services/saveData';
import { toggleVars, useTasks, useToggleTask } from '@/hooks/useTasks';
import { useWeeklyQuizzes } from '@/hooks/useWeeklyQuizzes';
import { useHomeScene } from '@/store/homeScene';
import { usePandaReaction } from '@/store/pandaReaction';
import { usePandaAnimation } from '@/hooks/usePandaAnimation';
import { useTrip } from '@/hooks/useTrip';
import { useTripStore } from '@/store/trip';
import { NOTE_SIZE, TripNote } from '@/v2/components/TripNote';
import { PandaWalker } from '@/v2/components/PandaWalker';
import { PostcardSheet } from '@/v2/components/PostcardSheet';
import { ReturnScene, RevealCard } from '@/v2/components/TripReturn';
import { SpeechBubble } from '@/v2/components/SpeechBubble';
import { HOME_DOOR, SCENE_RATIO } from '@/v2/images';
import { AdventureCard } from '@/v2/components/AdventureCard';
import { CelebrationCard } from '@/v2/components/CelebrationCard';
import { DayPill } from '@/v2/components/DayPill';
import { GoalRow } from '@/v2/components/GoalRow';
import { GoalSection } from '@/v2/components/GoalSection';
import { HomePoster } from '@/v2/components/HomePoster';
import { HomeVideo } from '@/v2/components/HomeVideo';
import { homeReactionsForStage, homeVideoForStage } from '@/v2/video';
import { PandaSprite } from '@/v2/components/PandaSprite';
import { SCENE_GROUND_OFFSET, SCENE_TOP_CLEAR, SceneHeader } from '@/v2/components/SceneHeader';
import { V2_MAX_WIDTH } from '@/v2/components/V2Screen';
import { v2Colors, v2Font, v2Radius, v2Spacing, v2Text } from '@/v2/theme';

const SCENE_HEIGHT = 300;
const PANDA_SIZE = 132;

/**
 * Hôm nay de l'enfant (V2, D-106) : décor (maison, ou la destination pendant une aventure, panda en marche), carte d'aventure, « Còn N việc », objectifs
 * groupés par moment de la journée, révision de la semaine dans « quand je veux », carte de fin de journée. Mêmes hooks, mutations et règles que la V1.
 */
export default function V2ChildHome() {
  const { t } = useTranslation();
  const router = useRouter();
  const d = useDisplayedChild();
  const now = useNow();
  const unread = useUnreadNotifications();
  const tz = d?.me.family.timezone ?? 'Asia/Ho_Chi_Minh';
  const today = todayInTz(now, tz);
  const nowTime = timeInTz(now, tz);
  const childId = d?.child?.id ?? null;
  const tasksQuery = useTasks(childId, today);
  const toggle = useToggleTask();
  const weekly = useWeeklyQuizzes(today, false);
  const companion = useCompanion(childId, !!childId).data;
  const adventure = useAdventure(childId, !!childId).data;
  const adventurePending = useAdventurePending(childId);
  const reacting = usePandaReaction((s) => s.active && s.childId === childId);
  const hopKey = usePandaReaction((s) => (s.childId === childId ? s.id : 0));
  const react = usePandaReaction((s) => s.trigger);
  const reactionEnergy = usePandaReaction((s) => (s.childId === childId ? s.energy : 0));
  const reduceMotion = useReduceMotion();
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const screenWidth = useWindowDimensions().width;
  const [reviewKey, setReviewKey] = useState<string | null>(null);
  const setSceneColor = useHomeScene((s) => s.setColor);

  const tasks = tasksQuery.data ?? [];
  const complete = dayComplete(tasks);
  // « Xem lại » vaut pour CET état de la journée : décocher (ou recocher) une tâche change la clé, la carte de fin revient quand tout est refait
  const doneKey = tasks.map((x) => `${x.id}:${x.completed_at ?? ''}`).join('|');
  const reviewing = reviewKey === doneKey;

  // D-107 : le grand départ et le retour (affichage seulement) ; le décor reste TOUJOURS la maison
  const trip = useTrip(childId, adventure);
  const departure = useTripStore((s) => (s.departure && s.departure.childId === childId ? s.departure : null));
  const finishDeparture = useTripStore((s) => s.finish);
  const leaving = departure !== null;
  const away = adventure?.state === 'away' ? adventure.active : null;
  const scene = 'home';
  // état vu par la vidéo d'accueil : pas de panda vidéo pendant le départ, le voyage, le retour et l'ouverture du paquet
  const shownState = leaving ? 'away' : trip.view === 'opened' ? 'back' : adventure?.state;
  const gaugeFull = adventure?.state === 'ready_to_go' && !leaving;
  // D-106 : vidéo d'accueil (maison, panda du stade AFFICHÉ) à la place du décor fixe et du panda, si toutes les conditions sont réunies (web seulement)
  const stageVideo = companion?.hasCompanion ? homeVideoForStage(companion.stage) : null;
  const stage = companion?.stage ?? 0;
  // panda vidéo (D-106) : `video`, `still` (images fixes : moins d'animations, économie de données, hors ligne ; stades à réactions seulement) ou `off`
  const media = companion?.hasCompanion
    ? homeMediaMode({
        scene,
        adventure: shownState,
        hasStageVideo: stageVideo !== null,
        variant: companion.variant,
        reduceMotion,
        saveData: prefersSaveData(),
        web: Platform.OS === 'web',
        hasReactions: homeReactionsForStage(stage) !== null,
        offline: Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.onLine === false,
      })
    : 'off';
  const video = media === 'video';
  // gestionnaire unique des animations du panda (repos, content, curieux, endormi) ; fin de journée = règle existante (`dayComplete`)
  const anim = usePandaAnimation({ childId, stage, today, dayDone: complete, ready: !tasksQuery.isPending, mode: media, gaugeFull });
  const reactionVideo = video && anim.reactions !== null;
  // D-106 : avec la vidéo (ou ses images fixes), le fond sous l'en-tête ET la barre d'onglets prolongent la vidéo (couleur de son sable)
  const extendColor = media !== 'off' && stageVideo ? stageVideo.groundColor : null;
  useEffect(() => {
    setSceneColor(focused ? extendColor : null);
  }, [focused, extendColor, setSceneColor]);
  useEffect(() => () => setSceneColor(null), [setSceneColor]);
  // départ laissé en plan (l'enfant est allé ailleurs) : la séquence ne se rejoue pas plus tard
  useEffect(() => {
    if (departure && Date.now() - departure.at > WALK_OUT_MS + 3000) finishDeparture();
  }, [departure, finishDeparture]);
  const [noteOpen, setNoteOpen] = useState(false);

  if (!d || !d.child) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={v2Colors.primary} />
      </View>
    );
  }
  const child = d.child;
  const pandaName = companion?.name ?? DEFAULT_PANDA_NAME;
  const done = tasks.length - remainingCount(tasks);
  const mood: PandaMood = reacting ? 'tres-heureux' : pandaMood(done, tasks.length, localHourOf(nowTime));
  const progress = away
    ? awayProgress(away.departedAt ? Date.parse(away.departedAt) : null, instantInTz(away.returnsOn, RETURN_MORNING, tz).getTime(), now.getTime())
    : 0;
  const banner = weekly.groups.filter((g) => g.childId === child.id).map((g) => bannerModel(g.items, today)).find((b) => b !== null) ?? null;
  const groups = groupByDaySection(tasks, banner !== null);
  const showList = !complete || reviewing;
  const goAdventure = () => router.push('/v2/child/adventure');
  const headerH = SCENE_HEIGHT + insets.top;
  const topClear = insets.top + SCENE_TOP_CLEAR;
  // toucher le panda (`curious`) : zone calquée sur le panda dans la vidéo, jamais sur les boutons du haut ni sur la carte posée en bas de l'en-tête
  const hit =
    reactionVideo && stageVideo && anim.reactions?.curious && screenWidth > 0
      ? pandaHitRect(homeVideoLayout({ width: screenWidth, height: headerH, groundY: headerH - SCENE_GROUND_OFFSET, topClear }, stageVideo.geometry), {
          topClear,
          bottomLimit: headerH - SCENE_GROUND_OFFSET + v2Spacing.sm,
          width: screenWidth,
        })
      : null;
  const pandaHome = !leaving && trip.view !== 'away';
  const reactionBubble =
    pandaHome && reacting && reactionEnergy > 0 ? (
      <View style={styles.reaction} pointerEvents="none">
        <Text style={styles.reactionText}>{t('panda.reaction', { energy: reactionEnergy })}</Text>
      </View>
    ) : null;


  const seed = tasks.length + done;
  const pandaTop = reactionVideo && stageVideo && screenWidth > 0
    ? homeVideoLayout({ width: screenWidth, height: headerH, groundY: headerH - SCENE_GROUND_OFFSET, topClear }, stageVideo.geometry).pandaTop
    : headerH - SCENE_GROUND_OFFSET - PANDA_SIZE;
  const speech = leaving
    ? t(pandaLineKey(companion?.stage ?? 2, 'adventure_leave', seed), pandaLineParams(child.name))
    : trip.view === 'back' && trip.step === 'gift'
      ? t(pandaLineKey(companion?.stage ?? 2, 'adventure_home_gift', seed), pandaLineParams(child.name))
      : trip.view === 'ready' && !reacting && companion?.hasCompanion
        ? t('v2.panda.letsGo')
        : null;
  const awayDest = away ? adventure?.destinations.find((x) => x.slug === away.destination) : undefined;
  const awayName = away ? t(`adventure.destinations.${away.destination}`) : '';
  const door = coverPoint({ width: screenWidth, height: headerH }, SCENE_RATIO, HOME_DOOR);
  const reveal = trip.reveal;
  const revealTimes = reveal ? (adventure?.found.find((f) => f.slug === reveal.discoverySlug)?.timesFound ?? 1) : 1;
  const revealLine = reveal
    ? t(
        pandaLineKey(companion?.stage ?? 2, reveal.duplicate ? 'adventure_duplicate' : (storySituation(reveal.destination) ?? 'adventure_back'), revealTimes),
        pandaLineParams(child.name, t(`adventure.destinations.${reveal.destination}`)),
      )
    : '';

  return (
    <View testID="v2-child-home" style={[styles.screen, extendColor ? { backgroundColor: extendColor } : null]}>
      <ScrollView role="main" contentContainerStyle={styles.scroll}>
        <SceneHeader
          scene={scene}
          height={SCENE_HEIGHT}
          left={[{ key: 'menu', Icon: Menu, label: t('v2.top.menu'), onPress: () => router.push('/v2/menu') }]}
          right={[
            { key: 'calendar', Icon: CalendarDays, label: t('v2.top.calendar'), onPress: () => router.push('/v2/calendar') },
            { key: 'bell', Icon: Bell, label: unread > 0 ? t('v2.top.notificationsCount', { count: unread }) : t('v2.top.notifications'), onPress: () => router.push('/notifications'), badge: unread },
          ]}
          backdrop={
            media !== 'off' && stageVideo ? (
              <HomePoster video={stageVideo} image={anim.poster} topClear={topClear} groundOffset={SCENE_GROUND_OFFSET} width={screenWidth} height={headerH} />
            ) : null
          }
          // stades à réactions vidéo : la vidéo joue « content » elle-même (jamais de fondu vers le décor fixe) ; autres stades : comme avant
          backdropVisible={media !== 'off' && (reactionVideo || media === 'still' || !reacting)}
          extendColor={extendColor}
          overlay={
            <>
            {video && stageVideo ? (
              <>
                <HomeVideo
                  video={stageVideo}
                  clip={anim.clip}
                  still={anim.still}
                  prefetch={reactionVideo ? [anim.reactions?.happy, anim.reactions?.curious, anim.reactions?.sleep, anim.reactions?.sleepLoop].filter((r) => r !== undefined).map((r) => r.sources) : undefined}
                  onEnded={anim.onEnded}
                  onFailed={anim.onFailed}
                  visible={reactionVideo || !reacting}
                  active={focused}
                  topClear={topClear}
                  groundOffset={SCENE_GROUND_OFFSET}
                  width={screenWidth}
                  height={headerH}
                />
                {reactionVideo && reactionBubble ? (
                  <View style={[styles.bubbleRow, { top: Math.max(topClear, (hit?.top ?? topClear) - 36) }]} pointerEvents="none">
                    {reactionBubble}
                  </View>
                ) : null}
                {hit ? (
                  <Pressable
                    testID="v2-panda-touch"
                    accessibilityRole="button"
                    accessibilityLabel={t('v2.panda.touch', { name: pandaName })}
                    onPress={anim.onTouched}
                    style={[styles.hit, { left: hit.left, top: hit.top, width: hit.width, height: hit.height }]}
                  />
                ) : null}
              </>
            ) : null}
            {speech ? (
              <View style={[styles.speechRow, { top: Math.max(topClear, pandaTop - 64) }]} pointerEvents="none">
                <SpeechBubble text={speech} testID="v2-panda-speech" />
              </View>
            ) : null}
            {trip.view === 'away' && !leaving && away && screenWidth > 0 ? (
              <TripNote
                left={door.x}
                top={Math.max(topClear + NOTE_SIZE / 2, door.y)}
                text={t(pandaLineKey(companion?.stage ?? 2, 'adventure_note', 0), pandaLineParams(child.name, awayName))}
                signature={t('v2.trip.signature', { name: pandaName })}
                onPress={() => setNoteOpen(true)}
              />
            ) : null}
            {leaving ? (
              <Pressable testID="v2-trip-skip" accessibilityRole="button" accessibilityLabel={t('v2.trip.skip')} onPress={finishDeparture} style={styles.skip} />
            ) : null}
            </>
          }
        >
          {companion?.hasCompanion && leaving ? (
            <PandaWalker
              testID="v2-trip-walk-out"
              stage={companion.stage}
              size={PANDA_SIZE}
              direction="out"
              durationMs={WALK_OUT_MS}
              reduceMotion={reduceMotion}
              onDone={finishDeparture}
              label={t('v2.trip.leaving', { name: pandaName, destination: t(`adventure.destinations.${departure.destination}`) })}
            />
          ) : companion?.hasCompanion && trip.view === 'away' ? null : companion?.hasCompanion && (trip.view === 'back' || trip.view === 'opened') ? (
            <ReturnScene
              stage={companion.stage}
              variant={companion.variant}
              pandaName={pandaName}
              size={PANDA_SIZE}
              step={trip.view === 'opened' ? 'open' : (trip.step ?? 'gift')}
              reduceMotion={reduceMotion}
              onEntered={trip.markEntered}
              onOpen={trip.openGift}
              opening={trip.opening}
              discovery={reveal?.discoverySlug ?? null}
              destinationName={t(`adventure.destinations.${reveal?.destination ?? adventure?.active?.destination ?? ''}`)}
            />
          ) : companion?.hasCompanion ? (
            <PandaSprite
              testID="v2-panda"
              stage={companion.stage}
              variant={companion.variant}
              name={pandaName}
              size={PANDA_SIZE}
              mood={mood}
              hopKey={hopKey}
            />
          ) : null}
          {reactionVideo ? null : reactionBubble}
        </SceneHeader>

        <View style={styles.content}>
          {companion && !companion.hasCompanion ? <PandaSetupCard childId={child.id} state={companion} /> : null}
          <ChildSetupGate />
          {adventure && companion?.hasCompanion ? (
            <AdventureCard
              adventure={adventure}
              pandaName={pandaName}
              variant={companion.variant}
              progress={progress}
              busy={adventurePending || trip.opening}
              onMap={goAdventure}
              onGo={goAdventure}
              onOpenBag={trip.view === 'back' ? trip.openGift : undefined}
              reactionEnergy={!pandaHome && reacting ? reactionEnergy : 0}
            />
          ) : null}
          {trip.opening ? <Text style={styles.waiting}>{t('adventure.pending')}</Text> : null}
          {reveal ? (
            <RevealCard
              discoveryName={t(`adventure.discoveries.${reveal.discoverySlug}`)}
              line={revealLine}
              duplicate={reveal.duplicate}
              times={revealTimes}
              onStore={trip.store}
            />
          ) : null}
          <DayPill remaining={remainingCount(tasks)} total={tasks.length} />

          {tasksQuery.isPending ? <ActivityIndicator color={v2Colors.primary} /> : null}
          {complete && !reviewing ? (
            <CelebrationCard
              stage={companion?.stage ?? 2}
              variant={companion?.variant}
              pandaName={pandaName}
              action={celebrationAction(adventure)}
              onGo={goAdventure}
              onReview={() => setReviewKey(doneKey)}
            />
          ) : null}
          {showList
            ? groups.map((g) => (
                <GoalSection key={g.section} section={g.section} count={g.items.length + (g.section === 'anytime' && banner ? 1 : 0)}>
                  {g.items.map((task) => {
                    const perms = taskPermissions(d.viewer, task);
                    const state = taskState(task);
                    const label = timeLabel(task);
                    const subtitle = label.kind === 'range' ? `${label.start} - ${label.end}` : label.kind === 'deadline' ? t('taskForm.deadlineLabel', { time: label.end }) : null;
                    return (
                      <GoalRow
                        key={task.id}
                        testID={`v2-goal-${task.id}`}
                        icon={goalIconFor(task)}
                        title={task.title}
                        subtitle={subtitle}
                        energy={task.points}
                        checked={state !== 'todo'}
                        pending={state === 'pending'}
                        toggleDisabled={!perms.canToggle}
                        onToggle={() => {
                          // le panda réagit tout de suite (même hors ligne), avant toute réponse du serveur (D-104)
                          if (task.completed_at === null) {
                            react(child.id, task.points);
                            anim.onChecked(task.id); // panda vidéo : « content », une fois par tâche et par jour
                          }
                          toggle.mutate(toggleVars(task, task.completed_at === null, false));
                        }}
                      />
                    );
                  })}
                  {g.section === 'anytime' && banner ? (
                    <GoalRow
                      testID="v2-goal-weekly"
                      icon={WEEKLY_REVIEW_ICON}
                      title={t('weekly.review.title')}
                      subtitle={banner.total > 0 ? `${banner.validated}/${banner.total}` : null}
                      energy={null}
                      checked={banner.done}
                      onOpen={() => router.push('/weekly')}
                    />
                  ) : null}
                </GoalSection>
              ))
            : null}
        </View>
      </ScrollView>
      {noteOpen && awayDest && adventure ? (
        <PostcardSheet
          visible
          readOnly
          destination={awayDest}
          adventure={adventure}
          stage={companion?.stage ?? 2}
          pandaName={pandaName}
          childName={child.name}
          pending={false}
          onGo={() => undefined}
          onClose={() => setNoteOpen(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: v2Colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: v2Colors.background },
  scroll: { paddingBottom: v2Spacing.xl },
  reaction: { position: 'absolute', top: 0, alignSelf: 'center', backgroundColor: v2Colors.card, borderRadius: v2Radius.pill, paddingHorizontal: v2Spacing.md, paddingVertical: 4 },
  reactionText: { ...v2Font(800, 16), color: v2Colors.energyText },
  hit: { position: 'absolute' },
  // bulle « +N ⚡ » au-dessus du panda vidéo (stades à réactions vidéo)
  bubbleRow: { position: 'absolute', left: 0, right: 0, height: 32, alignItems: 'center' },
  speechRow: { position: 'absolute', left: v2Spacing.lg, right: v2Spacing.lg, alignItems: 'center' },
  skip: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  waiting: { ...v2Text.bodyBold, color: v2Colors.pending, textAlign: 'center' },
  content: { padding: v2Spacing.lg, gap: v2Spacing.md, marginTop: -v2Spacing.xl, width: '100%', maxWidth: V2_MAX_WIDTH, alignSelf: 'center' },
});
