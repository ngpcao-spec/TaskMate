import { childVoice, type ChildVoice } from '@/domain/reward-exchange';
import { todayInTz } from '@/domain/family-time';
import { useDisplayedChild } from '@/hooks/useDisplayedChild';

/** Pronoms à employer avec l'enfant affiché (tớ/cậu ou mình/bạn, `childVoice`), au jour LOCAL de la famille. Contexte i18next : `{ context: voice }`. */
export function useChildVoice(): ChildVoice {
  const d = useDisplayedChild();
  if (!d?.child) return 'older';
  return childVoice(d.child.birth_date, todayInTz(new Date(), d.me.family.timezone));
}
