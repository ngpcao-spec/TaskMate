import { ageFromBirthDate } from './age';

/**
 * Aperçu d'un échange de récompense (feuille `RewardConfirmSheet`). `available` = solde DISPONIBLE renvoyé par le serveur (solde − points réservés
 * par les demandes en attente, vue `child_balances`, SPEC §3.7) : c'est la règle actuelle, jamais recalculée ici.
 */
export type ExchangePreview = { have: number; after: number; missing: number; affordable: boolean };

export function exchangePreview(available: number, cost: number): ExchangePreview {
  const have = Math.max(0, Math.trunc(available));
  const price = Math.max(0, Math.trunc(cost));
  const affordable = price <= have;
  return { have, after: affordable ? have - price : have, missing: affordable ? 0 : price - have, affordable };
}

/**
 * Façon de s'adresser à l'enfant en vietnamien : « tớ / cậu » (enfant jusqu'à 10 ans révolus, école primaire) ou « mình / bạn » (11 ans et plus).
 * Sert de contexte i18next (`t(key, { context })` → `key_young` / `key_older`, la clé de base reste le repli en fr/en).
 */
export type ChildVoice = 'young' | 'older';
export const YOUNG_VOICE_MAX_AGE = 10;

export function childVoice(birthDate: string | null | undefined, today: string): ChildVoice {
  if (!birthDate) return 'older';
  return ageFromBirthDate(birthDate, today) <= YOUNG_VOICE_MAX_AGE ? 'young' : 'older';
}

/** Demande ajoutée tout de suite à « Yêu cầu đổi thưởng » (avant la réponse du serveur, remplacée au rechargement). */
export type OptimisticRequest = {
  id: string;
  child_id: string;
  reward_id: string;
  reward_title: string;
  cost: number;
  status: 'pending';
  created_at: string;
  expires_at: string;
  decided_at: null;
  decided_by: null;
  decision_note: null;
};

export const REQUEST_EXPIRY_DAYS = 7;

export function optimisticRequest(o: { id: string; childId: string; rewardId: string; title: string; cost: number; now: Date }): OptimisticRequest {
  return {
    id: o.id,
    child_id: o.childId,
    reward_id: o.rewardId,
    reward_title: o.title,
    cost: o.cost,
    status: 'pending',
    created_at: o.now.toISOString(),
    expires_at: new Date(o.now.getTime() + REQUEST_EXPIRY_DAYS * 24 * 3600 * 1000).toISOString(),
    decided_at: null,
    decided_by: null,
    decision_note: null,
  };
}
