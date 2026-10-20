import { isValidTimeZone } from '@/domain/timezone';

/**
 * Assistant de première connexion (D-090) : logique PURE. Chaque étape est « faite » d'après les VRAIES données (enfants, matières, appareil, tâches,
 * récompenses, 2e parent) ; seule la confirmation de la langue est un drapeau explicite (valeurs préremplies). Une étape PASSÉE reste « à faire » :
 * elle ne compte jamais comme faite. Aucune fonction ici ne compare ni ne classe les enfants.
 */

export const OWNER_STEPS = ['language', 'children', 'subjects', 'notifications', 'content', 'coparent'] as const;
/** Un parent INVITÉ ne fait qu'un assistant court : langue + notifications. */
export const INVITED_STEPS = ['language', 'notifications'] as const;
export type StepKey = (typeof OWNER_STEPS)[number];
export type StepStatus = 'done' | 'skipped' | 'todo';

export const isStepKey = (v: unknown): v is StepKey => typeof v === 'string' && (OWNER_STEPS as readonly string[]).includes(v);

export type OnboardingChild = { id: string; name: string; country: string | null; grade: string | null; subjects: string[]; available: string[] };

/** Réponse de la RPC `onboarding_state` (faits de la famille du parent connecté). */
export type ServerOnboarding = {
  isOwner: boolean;
  languageConfirmed: boolean;
  skipped: StepKey[];
  cardHidden: boolean;
  children: OnboardingChild[];
  tasks: number;
  rewards: number;
  parents: number;
  inviteActive: boolean;
};

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const count = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** Valide la réponse de la RPC (jamais de confiance aveugle) ; null = illisible. */
export function parseOnboarding(raw: unknown): ServerOnboarding | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== 'object' || typeof r.is_owner !== 'boolean' || typeof r.language_confirmed !== 'boolean' || !Array.isArray(r.children)) return null;
  const children: OnboardingChild[] = [];
  for (const c of r.children) {
    const o = c as Record<string, unknown> | null;
    if (!o || typeof o.id !== 'string' || typeof o.name !== 'string') return null;
    children.push({
      id: o.id,
      name: o.name,
      country: typeof o.country === 'string' ? o.country : null,
      grade: typeof o.grade === 'string' ? o.grade : null,
      subjects: strings(o.subjects),
      available: strings(o.available),
    });
  }
  return {
    isOwner: r.is_owner,
    languageConfirmed: r.language_confirmed,
    skipped: strings(r.skipped).filter(isStepKey),
    cardHidden: r.card_hidden === true,
    children,
    tasks: count(r.tasks),
    rewards: count(r.rewards),
    parents: count(r.parents),
    inviteActive: r.invite_active === true,
  };
}

/** Faits complets : l'état serveur + le seul fait propre à l'appareil (CET appareil/navigateur a-t-il une ligne `devices` active pour ce parent ?). */
export type OnboardingFacts = ServerOnboarding & { deviceActive: boolean };

export const stepsFor = (owner: boolean): readonly StepKey[] => (owner ? OWNER_STEPS : INVITED_STEPS);

/**
 * Étape 3 : chaque enfant a au moins une matière activée. Un enfant dont la classe n'a AUCUN contenu publié n'a rien à activer : il ne bloque pas l'étape
 * (sinon elle ne pourrait jamais être terminée). Sans enfant, l'étape n'est pas faite.
 */
export const subjectsDone = (children: readonly OnboardingChild[]): boolean =>
  children.length > 0 && children.every((c) => c.subjects.length > 0 || c.available.length === 0);

/** Étape faite d'après les DONNÉES (un drapeau « vu » ne suffit jamais, sauf la langue). */
export function isStepDone(step: StepKey, f: OnboardingFacts): boolean {
  switch (step) {
    case 'language':
      return f.languageConfirmed;
    case 'children':
      return f.children.length >= 1;
    case 'subjects':
      return subjectsDone(f.children);
    case 'notifications':
      return f.deviceActive;
    case 'content':
      return f.tasks >= 1 && f.rewards >= 1;
    case 'coparent':
      return f.parents >= 2 || f.inviteActive;
  }
}

export type StepState = { key: StepKey; status: StepStatus };

export type OnboardingProgress = {
  steps: StepState[];
  done: number;
  total: number;
  /** Prochaine étape à mettre en avant : la première non faite et non passée ; à défaut, la première passée ; null si tout est fait. */
  next: StepKey | null;
  complete: boolean;
};

export function onboardingProgress(f: OnboardingFacts): OnboardingProgress {
  const steps: StepState[] = stepsFor(f.isOwner).map((key) => ({ key, status: isStepDone(key, f) ? 'done' : f.skipped.includes(key) ? 'skipped' : 'todo' }));
  const done = steps.filter((s) => s.status === 'done').length;
  const next = steps.find((s) => s.status === 'todo')?.key ?? steps.find((s) => s.status === 'skipped')?.key ?? null;
  return { steps, done, total: steps.length, next, complete: done === steps.length };
}

/**
 * Carte « Hoàn tất cài đặt » de Hôm nay : PARENT seulement, tant que des étapes manquent (faites ou non, les étapes passées restent à faire),
 * sauf si le parent l'a masquée. Une famille existante complète n'a donc aucune carte.
 */
export function showSetupCard(f: OnboardingFacts | null, role: 'parent' | 'child'): boolean {
  if (role !== 'parent' || !f || f.cardHidden) return false;
  return !onboardingProgress(f).complete;
}

/** Lancement automatique UNIQUEMENT pour une famille neuve (aucun enfant) : jamais pour une famille existante. */
export const shouldAutoLaunch = (role: 'parent' | 'child', childrenCount: number): boolean => role === 'parent' && childrenCount === 0;

/** Seule la création d'un premier enfant est obligatoire : « Bỏ qua » n'existe pas à l'étape enfants tant qu'aucun enfant n'est créé. */
export const canSkipStep = (step: StepKey, childrenCount: number): boolean => step !== 'children' || childrenCount >= 1;

export const stepPath = (step: StepKey): `/onboarding/setup/${StepKey}` => `/onboarding/setup/${step}`;

/** Étape suivante / précédente dans le parcours du parent (null aux bornes). */
export function neighbour(step: StepKey, owner: boolean, delta: -1 | 1): StepKey | null {
  const list = stepsFor(owner);
  const i = list.indexOf(step);
  return i < 0 ? null : (list[i + delta] ?? null);
}

/** Étape où REPRENDRE : la première à faire (non passée) ; à défaut la première passée ; à défaut (tout fait) null. */
export const resumeStep = (f: OnboardingFacts): StepKey | null => onboardingProgress(f).next;

/** Position « Bước n/total » d'une étape dans le parcours (1-based) ; 0 si l'étape n'en fait pas partie. */
export const stepNumber = (step: StepKey, owner: boolean): number => stepsFor(owner).indexOf(step) + 1;

// ───────────── notifications (étape 4) ─────────────
/** iOS hors PWA installée : le Web Push n'existe que pour une app lancée depuis l'écran d'accueil ; les sous-étapes suivantes restent verrouillées. */
export const needsInstall = (ios: boolean, standalone: boolean): boolean => ios && !standalone;

// ───────────── identifiant d'enfant ─────────────
/** L'identifiant est unique PAR FAMILLE : vérification locale (sans espace, casse ignorée) avant l'appel ; le serveur reste l'autorité. */
export const loginIdTaken = (existing: readonly string[], loginId: string): boolean => {
  const id = loginId.trim().toLowerCase();
  return id !== '' && existing.some((e) => e.trim().toLowerCase() === id);
};

// ───────────── étape 1 : langue et fuseau préremplis ─────────────
export type OnboardingLanguage = 'vi' | 'fr' | 'en';

/** Langue suggérée : celle du navigateur (« fr-FR » → fr), vietnamien par défaut. */
export function detectLanguage(browserLanguage: string | null | undefined): OnboardingLanguage {
  const base = (browserLanguage ?? '').trim().toLowerCase().split(/[-_]/)[0];
  return base === 'fr' || base === 'en' ? base : 'vi';
}

/** Fuseau suggéré : celui de l'appareil s'il est valide ; sinon celui déjà enregistré pour la famille. Une seule confirmation, jamais dérivé d'un horodatage. */
export const suggestTimeZone = (device: string | null | undefined, current: string): string => (device && isValidTimeZone(device) ? device : current);

// ───────────── parcours enfant (1 écran, 2 gestes) ─────────────
/** Clé locale (par appareil) : l'écran ne revient jamais tout seul ; il reste accessible depuis les Réglages de l'enfant. */
export const childSetupSeenKey = (memberId: string): string => `taskmate-child-setup-seen-${memberId}`;

/** Proposé UNE fois, au premier login d'un enfant dont CET appareil n'a pas de ligne `devices` active. */
export const shouldShowChildSetup = (seen: boolean, deviceRegistered: boolean): boolean => !seen && !deviceRegistered;
