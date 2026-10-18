import { useQueries } from '@tanstack/react-query';
import { fetchCatalogUpcoming, fetchParentCatalog } from '@/api/catalog';
import { quizKeys } from '@/api/keys';
import { childWeeklyInputs, parentWeeklyInputs, upcomingItems, visibleWeekly, type WeeklyItem } from '@/domain/weekly-quiz';
import { useDisplayedChild } from './useDisplayedChild';
import { useChildQuizSets } from './useQuizzes';

/** Révisions de la semaine d'UN enfant (D-083). */
export type WeeklyGroup = { childId: string; childName: string; items: WeeklyItem[] };

/**
 * Lignes « Révisions » de Hôm nay et marqueurs du calendrier, calculées côté appareil (aucune ligne dans `tasks`).
 * Enfant : SES quiz seulement (D-052). Parent : un groupe par enfant de la famille, dans l'ordre de la liste, sans classement ni comparaison.
 * `windowed: false` (calendrier) garde aussi les quiz dont la fenêtre d'affichage est close. `withUpcoming` (écran Ôn tập, D-086) ajoute les quiz PAS ENCORE
 * OUVERTS (métadonnées seulement) ; leur erreur de lecture est silencieuse (l'écran garde les quiz ouverts). Une erreur de lecture n'affiche rien : l'écran Hôm nay ne dépend jamais de cette lecture.
 */
export function useWeeklyQuizzes(today: string, windowed = true, withUpcoming = false): { groups: WeeklyGroup[]; isPending: boolean } {
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
  // enfant : UNE lecture (le serveur déduit son identité, jamais celle d'un autre) ; parent : une par enfant de sa famille
  const upcomingTargets: (string | null)[] = isParent ? children.map((c) => c.id) : [null];
  const upcoming = useQueries({
    queries: upcomingTargets.map((target) => ({
      queryKey: quizKeys.upcoming(target ?? 'me'),
      queryFn: () => fetchCatalogUpcoming(target),
      enabled: withUpcoming && !!d,
      staleTime: 0,
      retry: false,
    })),
  });
  if (!d) return { groups: [], isPending: true };
  if (!isParent) {
    const child = d.child;
    const rows = own.data ?? [];
    const inputs = childWeeklyInputs(rows);
    const items = [...visibleWeekly(inputs, today, windowed), ...upcomingItems(upcoming[0]?.data ?? [])];
    return { groups: child ? [{ childId: child.id, childName: child.name, items }] : [], isPending: own.isPending };
  }
  return {
    groups: children.map((c, i) => ({
      childId: c.id,
      childName: c.name,
      items: [...visibleWeekly(parentWeeklyInputs(overviews[i]?.data ?? []), today, windowed), ...upcomingItems(upcoming[i]?.data ?? [])],
    })),
    isPending: overviews.some((q) => q.isPending),
  };
}
