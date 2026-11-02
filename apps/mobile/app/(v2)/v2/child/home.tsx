import { useIsFocused, useRouter } from 'expo-router';
import { Bell, CalendarDays, Menu } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PandaSetupCard } from '@/components/companion/PandaSetupCard';
import { ChildSetupGate } from '@/components/onboarding/ChildSetupGate';
import { awayProgress, RETURN_MORNING } from '@/domain/adventure';
import { celebrationAction, dayComplete, groupByDaySection, remainingCount } from '@/domain/day-sections';
import { timeInTz, todayInTz } from '@/domain/family-time';
import { goalIconFor, WEEKLY_REVIEW_ICON } from '@/domain/goal-icons';
import { showHomeVideo } from '@/domain/home-video';
import { DEFAULT_PANDA_NAME, localHourOf, pandaMood, type PandaMood } from '@/domain/panda';
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
import { usePandaReaction } from '@/store/pandaReaction';
import { AdventureCard } from '@/v2/components/AdventureCard';
import { CelebrationCard } from '@/v2/components/CelebrationCard';
import { DayPill } from '@/v2/components/DayPill';
import { GoalRow } from '@/v2/components/GoalRow';
import { GoalSection } from '@/v2/components/GoalSection';
import { HomeVideo } from '@/v2/components/HomeVideo';
import { PandaSprite } from '@/v2/components/PandaSprite';
import { SCENE_GROUND_OFFSET, SCENE_TOP_CLEAR, SceneHeader } from '@/v2/components/SceneHeader';
import { V2_MAX_WIDTH } from '@/v2/components/V2Screen';
import { v2Colors, v2Font, v2Radius, v2Spacing } from '@/v2/theme';

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

  const tasks = tasksQuery.data ?? [];
  const complete = dayComplete(tasks);
  // « Xem lại » vaut pour CET état de la journée : décocher (ou recocher) une tâche change la clé, la carte de fin revient quand tout est refait
  const doneKey = tasks.map((x) => `${x.id}:${x.completed_at ?? ''}`).join('|');
  const reviewing = reviewKey === doneKey;

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
  const away = adventure?.state === 'away' ? adventure.active : null;
  const back = adventure?.state === 'back';
  const scene = away ? away.destination : 'home';
  const progress = away
    ? awayProgress(away.departedAt ? Date.parse(away.departedAt) : null, instantInTz(away.returnsOn, RETURN_MORNING, tz).getTime(), now.getTime())
    : 0;
  const banner = weekly.groups.filter((g) => g.childId === child.id).map((g) => bannerModel(g.items, today)).find((b) => b !== null) ?? null;
  const groups = groupByDaySection(tasks, banner !== null);
  const showList = !complete || reviewing;
  const goAdventure = () => router.push('/v2/child/adventure');
  // D-106 : vidéo d'accueil (maison, panda teen) à la place du décor fixe et du panda, si toutes les conditions sont réunies (web seulement)
  const video =
    !!companion?.hasCompanion &&
    showHomeVideo({ scene, adventure: adventure?.state, stage: companion.stage, variant: companion.variant, reduceMotion, saveData: prefersSaveData(), web: Platform.OS === 'web' });

  return (
    <View style={styles.screen}>
      <ScrollView role="main" contentContainerStyle={styles.scroll}>
        <SceneHeader
          scene={scene}
          height={SCENE_HEIGHT}
          left={[{ key: 'menu', Icon: Menu, label: t('v2.top.menu'), onPress: () => router.push('/v2/menu') }]}
          right={[
            { key: 'calendar', Icon: CalendarDays, label: t('v2.top.calendar'), onPress: () => router.push('/v2/calendar') },
            { key: 'bell', Icon: Bell, label: unread > 0 ? t('v2.top.notificationsCount', { count: unread }) : t('v2.top.notifications'), onPress: () => router.push('/notifications'), badge: unread },
          ]}
          sceneHidden={video && !reacting}
          overlay={video ? <HomeVideo visible={!reacting} active={focused} topClear={insets.top + SCENE_TOP_CLEAR} groundOffset={SCENE_GROUND_OFFSET} width={screenWidth} height={SCENE_HEIGHT + insets.top} /> : null}
        >
          {companion?.hasCompanion ? (
            <PandaSprite
              testID="v2-panda"
              stage={companion.stage}
              variant={companion.variant}
              name={pandaName}
              size={PANDA_SIZE}
              mood={mood}
              expression={back && !reacting ? 'surpris' : undefined}
              walking={!!away}
              hopKey={hopKey}
            />
          ) : null}
          {reacting && reactionEnergy > 0 ? (
            <View style={styles.reaction} pointerEvents="none">
              <Text style={styles.reactionText}>{t('panda.reaction', { energy: reactionEnergy })}</Text>
            </View>
          ) : null}
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
              busy={adventurePending}
              onMap={goAdventure}
              onGo={goAdventure}
              onOpenBag={adventure.active ? () => router.push({ pathname: '/adventure/reveal', params: { id: adventure.active!.id } }) : undefined}
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
                          if (task.completed_at === null) react(child.id, task.points);
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: v2Colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: v2Colors.background },
  scroll: { paddingBottom: v2Spacing.xl },
  reaction: { position: 'absolute', top: 0, alignSelf: 'center', backgroundColor: v2Colors.card, borderRadius: v2Radius.pill, paddingHorizontal: v2Spacing.md, paddingVertical: 4 },
  reactionText: { ...v2Font(800, 16), color: v2Colors.energyText },
  content: { padding: v2Spacing.lg, gap: v2Spacing.md, marginTop: -v2Spacing.xl, width: '100%', maxWidth: V2_MAX_WIDTH, alignSelf: 'center' },
});
