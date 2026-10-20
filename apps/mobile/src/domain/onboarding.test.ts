import {
  childSetupSeenKey, shouldShowChildSetup, detectLanguage, suggestTimeZone, canSkipStep, INVITED_STEPS, isStepDone, loginIdTaken, needsInstall, neighbour, onboardingProgress, OWNER_STEPS, parseOnboarding, resumeStep, shouldAutoLaunch, showSetupCard, stepNumber, stepPath,
  subjectsDone, type OnboardingFacts, type OnboardingChild,
} from './onboarding';

const kid = (over: Partial<OnboardingChild> = {}): OnboardingChild => ({ id: 'c1', name: 'Minh', country: 'VN', grade: '7', subjects: ['maths'], available: ['maths', 'hist_geo'], ...over });
const full = (over: Partial<OnboardingFacts> = {}): OnboardingFacts => ({
  isOwner: true, languageConfirmed: true, skipped: [], cardHidden: false, children: [kid()], tasks: 2, rewards: 1, parents: 2, inviteActive: false, deviceActive: true, ...over,
});
const empty = (over: Partial<OnboardingFacts> = {}): OnboardingFacts => ({
  isOwner: true, languageConfirmed: false, skipped: [], cardHidden: false, children: [], tasks: 0, rewards: 0, parents: 1, inviteActive: false, deviceActive: false, ...over,
});

describe('étapes faites d’après les VRAIES données', () => {
  it('1 langue : seulement le drapeau explicite (les valeurs sont préremplies)', () => {
    expect(isStepDone('language', empty())).toBe(false);
    expect(isStepDone('language', empty({ languageConfirmed: true }))).toBe(true);
  });
  it('2 enfants : au moins un enfant', () => {
    expect(isStepDone('children', empty())).toBe(false);
    expect(isStepDone('children', empty({ children: [kid()] }))).toBe(true);
  });
  it('3 révisions : chaque enfant a une matière activée', () => {
    expect(isStepDone('subjects', empty())).toBe(false); // sans enfant : pas faite
    expect(isStepDone('subjects', empty({ children: [kid({ subjects: [] })] }))).toBe(false);
    expect(isStepDone('subjects', empty({ children: [kid(), kid({ id: 'c2', subjects: [] })] }))).toBe(false); // un seul enfant sans matière suffit à bloquer
    expect(isStepDone('subjects', empty({ children: [kid(), kid({ id: 'c2', subjects: ['sciences'] })] }))).toBe(true);
  });
  it('3 révisions : une classe sans aucun contenu publié ne bloque pas l’étape (rien à activer)', () => {
    expect(subjectsDone([kid({ subjects: [], available: [] })])).toBe(true);
    expect(subjectsDone([kid({ subjects: [], available: [] }), kid({ id: 'c2', subjects: [] })])).toBe(false);
    expect(subjectsDone([])).toBe(false);
  });
  it('4 notifications : CET appareil a une ligne active', () => {
    expect(isStepDone('notifications', empty())).toBe(false);
    expect(isStepDone('notifications', empty({ deviceActive: true }))).toBe(true);
  });
  it('5 tâches ET récompenses : au moins une de chaque', () => {
    expect(isStepDone('content', empty({ tasks: 1 }))).toBe(false);
    expect(isStepDone('content', empty({ rewards: 1 }))).toBe(false);
    expect(isStepDone('content', empty({ tasks: 1, rewards: 1 }))).toBe(true);
  });
  it('6 deuxième parent : un 2e parent existe OU une invitation est active', () => {
    expect(isStepDone('coparent', empty())).toBe(false);
    expect(isStepDone('coparent', empty({ parents: 2 }))).toBe(true);
    expect(isStepDone('coparent', empty({ inviteActive: true }))).toBe(true);
  });
});

describe('progression', () => {
  it('famille neuve : 0/6, prochaine étape = langue', () => {
    const p = onboardingProgress(empty());
    expect(p).toMatchObject({ done: 0, total: 6, next: 'language', complete: false });
    expect(p.steps.map((s) => s.key)).toEqual([...OWNER_STEPS]);
  });
  it('une étape passée reste « à faire » : elle ne compte pas comme faite', () => {
    const p = onboardingProgress(empty({ languageConfirmed: true, children: [kid({ subjects: [] })], skipped: ['subjects', 'notifications'] }));
    expect(p.done).toBe(2);
    expect(p.steps.find((s) => s.key === 'subjects')?.status).toBe('skipped');
    expect(p.steps.find((s) => s.key === 'content')?.status).toBe('todo');
  });
  it('la prochaine étape ignore les étapes passées tant qu’il en reste d’autres ; sinon elle revient à la première passée', () => {
    expect(onboardingProgress(empty({ languageConfirmed: true, children: [kid({ subjects: [] })], skipped: ['subjects'] })).next).toBe('notifications');
    const onlySkipped = full({ skipped: ['coparent'], parents: 1, tasks: 1, rewards: 1 });
    expect(onboardingProgress(onlySkipped).next).toBe('coparent');
  });
  it('une étape passée puis réellement faite compte comme faite', () => {
    expect(onboardingProgress(full({ skipped: ['content'] })).steps.find((s) => s.key === 'content')?.status).toBe('done');
  });
  it('tout fait : 6/6, aucune prochaine étape', () => {
    expect(onboardingProgress(full())).toMatchObject({ done: 6, total: 6, next: null, complete: true });
  });
  it('parent INVITÉ : assistant court (langue + notifications)', () => {
    const p = onboardingProgress(empty({ isOwner: false, parents: 2 }));
    expect(p.steps.map((s) => s.key)).toEqual([...INVITED_STEPS]);
    expect(p).toMatchObject({ done: 0, total: 2, next: 'language' });
    expect(onboardingProgress(empty({ isOwner: false, languageConfirmed: true, deviceActive: true })).complete).toBe(true);
  });
  it('reprise : première étape à faire', () => {
    expect(resumeStep(empty({ languageConfirmed: true }))).toBe('children');
    expect(resumeStep(full())).toBeNull();
  });
});

describe('carte de Hôm nay', () => {
  it('famille existante COMPLÈTE : aucune carte', () => {
    expect(showSetupCard(full(), 'parent')).toBe(false);
  });
  it('famille existante incomplète : carte', () => {
    expect(showSetupCard(full({ rewards: 0 }), 'parent')).toBe(true);
  });
  it('étapes passées : la carte reste (elles restent à faire) ; masquée : plus de carte', () => {
    expect(showSetupCard(full({ skipped: ['coparent'], parents: 1 }), 'parent')).toBe(true);
    expect(showSetupCard(full({ parents: 1, cardHidden: true }), 'parent')).toBe(false);
  });
  it('jamais pour un enfant, ni sans données', () => {
    expect(showSetupCard(empty(), 'child')).toBe(false);
    expect(showSetupCard(null, 'parent')).toBe(false);
  });
});

describe('lancement automatique et parcours', () => {
  it('seulement pour un parent sans enfant (famille neuve)', () => {
    expect(shouldAutoLaunch('parent', 0)).toBe(true);
    expect(shouldAutoLaunch('parent', 1)).toBe(false);
    expect(shouldAutoLaunch('child', 0)).toBe(false);
  });
  it('« Bỏ qua » n’existe pas à l’étape enfants tant qu’aucun enfant n’est créé', () => {
    expect(canSkipStep('children', 0)).toBe(false);
    expect(canSkipStep('children', 1)).toBe(true);
    for (const s of OWNER_STEPS.filter((x) => x !== 'children')) expect(canSkipStep(s, 0)).toBe(true);
  });
  it('voisins, numéros et chemins', () => {
    expect(neighbour('language', true, -1)).toBeNull();
    expect(neighbour('language', true, 1)).toBe('children');
    expect(neighbour('coparent', true, 1)).toBeNull();
    expect(neighbour('language', false, 1)).toBe('notifications');
    expect(neighbour('subjects', false, 1)).toBeNull();
    expect(stepNumber('notifications', true)).toBe(4);
    expect(stepNumber('notifications', false)).toBe(2);
    expect(stepNumber('subjects', false)).toBe(0);
    expect(stepPath('content')).toBe('/onboarding/setup/content');
  });
});

describe('notifications et identifiant', () => {
  it('installation requise : iOS hors mode standalone seulement', () => {
    expect(needsInstall(true, false)).toBe(true);
    expect(needsInstall(true, true)).toBe(false);
    expect(needsInstall(false, false)).toBe(false);
  });
  it('identifiant déjà pris dans la famille : casse et espaces ignorés', () => {
    expect(loginIdTaken(['minh', 'Khang'], ' MINH ')).toBe(true);
    expect(loginIdTaken(['minh'], 'lan')).toBe(false);
    expect(loginIdTaken(['minh'], '')).toBe(false);
  });
});

describe('parseOnboarding', () => {
  const raw = {
    is_owner: true, language_confirmed: true, skipped: ['subjects', 'inconnue', 3], card_hidden: false,
    children: [{ id: 'c1', name: 'Minh', country: 'VN', grade: '7', subjects: ['maths'], available: ['maths'] }], tasks: 3, rewards: 2, parents: 2, invite_active: true,
  };
  it('lit une réponse valide ; ignore les étapes inconnues', () => {
    expect(parseOnboarding(raw)).toEqual({
      isOwner: true, languageConfirmed: true, skipped: ['subjects'], cardHidden: false,
      children: [{ id: 'c1', name: 'Minh', country: 'VN', grade: '7', subjects: ['maths'], available: ['maths'] }], tasks: 3, rewards: 2, parents: 2, inviteActive: true,
    });
  });
  it('valeurs absentes ou invalides : repli sûr', () => {
    const p = parseOnboarding({ is_owner: false, language_confirmed: false, children: [{ id: 'c1', name: 'M', country: 5, subjects: 'x' }], tasks: -4, rewards: 'a' });
    expect(p).toMatchObject({ isOwner: false, skipped: [], cardHidden: false, tasks: 0, rewards: 0, parents: 0, inviteActive: false });
    expect(p?.children[0]).toEqual({ id: 'c1', name: 'M', country: null, grade: null, subjects: [], available: [] });
  });
  it('réponse illisible = null', () => {
    for (const bad of [null, 'x', {}, { is_owner: true }, { is_owner: true, language_confirmed: true, children: [{ id: 1 }] }, { is_owner: 'oui', language_confirmed: true, children: [] }]) expect(parseOnboarding(bad)).toBeNull();
  });
});

describe('préremplissage de l’étape 1', () => {
  it('langue du navigateur ; vietnamien par défaut', () => {
    expect(detectLanguage('fr-FR')).toBe('fr');
    expect(detectLanguage('en_US')).toBe('en');
    expect(detectLanguage('vi')).toBe('vi');
    expect(detectLanguage('de-DE')).toBe('vi');
    expect(detectLanguage('')).toBe('vi');
    expect(detectLanguage(null)).toBe('vi');
    expect(detectLanguage(undefined)).toBe('vi');
  });
  it('fuseau de l’appareil s’il est valide, sinon celui de la famille', () => {
    expect(suggestTimeZone('Europe/Paris', 'Asia/Ho_Chi_Minh')).toBe('Europe/Paris');
    expect(suggestTimeZone('Pas/UnFuseau', 'Asia/Ho_Chi_Minh')).toBe('Asia/Ho_Chi_Minh');
    expect(suggestTimeZone(undefined, 'Asia/Bangkok')).toBe('Asia/Bangkok');
    expect(suggestTimeZone('', 'Asia/Bangkok')).toBe('Asia/Bangkok');
  });
});

describe('parcours enfant', () => {
  it('proposé seulement une fois et seulement sans appareil actif', () => {
    expect(shouldShowChildSetup(false, false)).toBe(true);
    expect(shouldShowChildSetup(true, false)).toBe(false); // « Để sau » : ne revient pas tout seul
    expect(shouldShowChildSetup(false, true)).toBe(false); // déjà notifié
    expect(shouldShowChildSetup(true, true)).toBe(false);
  });
  it('clé locale propre à chaque membre', () => {
    expect(childSetupSeenKey('m1')).not.toBe(childSetupSeenKey('m2'));
  });
});
