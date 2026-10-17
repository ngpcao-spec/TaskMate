import { useQueries } from '@tanstack/react-query';
import { fetchParentCatalog } from '@/api/catalog';
import { quizKeys } from '@/api/keys';
import { childWeeklyInputs, parentWeeklyInputs, visibleWeekly, type WeeklyItem } from '@/domain/weekly-quiz';
import { useDisplayedChild } from './useDisplayedChild';
import { useChildQuizSets } from './useQuizzes';

/** Révisions de la semaine d'UN enfant (D-083). */
export type WeeklyGroup = { childId: string; childName: string; items: WeeklyItem[] };

/**
 * Lignes « Révisions » de Hôm nay et marqueurs du calendrier, calculées côté appareil (aucune ligne dans `tasks`).
 * Enfant : SES quiz seulement (D-052). Parent : un groupe par enfant de la famille, dans l'ordre de la liste, sans classement ni comparaison.
 * `windowed: false` (calendrier) garde aussi les quiz dont la fenêtre d'affichage est close. Une erreur de lecture n'affiche rien : l'écran Hôm nay ne dépend jamais de cette lecture.
 */
export function useWeeklyQuizzes(today: string, windowed = true): { groups: WeeklyGroup[]; isPending: boolean } {
  const d = useDisplayedChild();
  const isParent = d?.viewer.role === 'parent';
  const own = useChildQuizSets(!!d && !isParent);
  const children = d?.children ?? [];
  const overviews = useQueries({
    queries: children.map((c) => ({
      queryKey: quizKeys.parentCatalog(c.id),
      queryFn: () => fetchParentCatalog(c.id),
      enabled: isParent,
      staleTime: 0,
    })),
  });
  if (!d) return { groups: [], isPending: true };
  if (!isParent) {
    const child = d.child;
    const rows = own.data ?? [];
    const inputs = childWeeklyInputs(rows);
    return { groups: child ? [{ childId: child.id, childName: child.name, items: visibleWeekly(inputs, today, windowed) }] : [], isPending: own.isPending };
  }
  return {
    groups: children.map((c, i) => ({ childId: c.id, childName: c.name, items: visibleWeekly(parentWeeklyInputs(overviews[i]?.data ?? []), today, windowed) })),
    isPending: overviews.some((q) => q.isPending),
  };
}
