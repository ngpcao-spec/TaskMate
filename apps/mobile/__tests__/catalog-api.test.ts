import { confirmCatalogAnswers, fetchCatalogQuizImpact, fetchIsPlatformAdmin, purgeCatalogQuiz, setCatalogDates, setChildClass, shiftChildSubject, upsertCatalogQuestion } from '@/api/catalog';
import { fetchAttemptDetail, fetchChildQuizSets, startQuizEvaluation } from '@/api/quizzes';

const mockRpc = jest.fn();
const mockMaybeSingle = jest.fn();
jest.mock('@/api/supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => mockRpc(...a),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => mockMaybeSingle() }) }) }),
  },
}));

beforeEach(() => {
  mockRpc.mockReset();
  mockMaybeSingle.mockReset();
});

const familyRow = { set_id: 's1', title: 'Fractions', subject: 'Toán', question_count: 3, evaluation_attempt_id: null, evaluation_status: null, can_start_evaluation: true, paper_support: false, answer_sheet_only: false, due_on: null, answered_count: 0 };
const catalogRow = { quiz_id: 'z1', subject: 'maths', week_label: 'Tuần 3', title: 'Phân số', question_count: 10, evaluation_attempt_id: 'a1', evaluation_status: 'in_progress', can_start_evaluation: false, paper_support: true, answer_sheet_only: false, due_on: '2026-09-13', answered_count: 4 };

describe('API catalogue (D-080)', () => {
  it('liste de l\'enfant : quiz du catalogue ET jeux de famille dans une même liste, avec leur source', async () => {
    mockRpc.mockImplementation(async (fn: string) => (fn === 'child_quiz_sets' ? { data: [familyRow], error: null } : { data: [catalogRow], error: null }));
    const list = await fetchChildQuizSets();
    expect(list.map((s) => [s.set_id, s.source])).toEqual([['z1', 'catalog'], ['s1', 'family']]);
    expect(list[0]).toMatchObject({ subject_key: 'maths', week_label: 'Tuần 3', subject: null, title: 'Phân số', evaluation_attempt_id: 'a1', answered_count: 4, due_on: '2026-09-13', paper_support: true });
    expect(list[1]).toMatchObject({ subject_key: null, week_label: null, subject: 'Toán' });
  });
  it('pendant un déploiement (fonction du catalogue absente) : seuls les jeux de famille ; toute autre erreur est remontée', async () => {
    mockRpc.mockImplementation(async (fn: string) => (fn === 'child_quiz_sets' ? { data: [familyRow], error: null } : { data: null, error: { code: 'PGRST202', message: 'not found' } }));
    expect((await fetchChildQuizSets()).map((s) => s.source)).toEqual(['family']);
    mockRpc.mockImplementation(async (fn: string) => (fn === 'child_quiz_sets' ? { data: [familyRow], error: null } : { data: null, error: { code: '42501', message: 'forbidden' } }));
    await expect(fetchChildQuizSets()).rejects.toMatchObject({ message: 'forbidden' });
  });
  it('démarrage : RPC du catalogue ou du jeu de famille selon la source (défaut : famille)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await startQuizEvaluation('z1', 'att-1', 'catalog');
    expect(mockRpc).toHaveBeenLastCalledWith('start_catalog_evaluation', { p_quiz: 'z1', p_attempt: 'att-1' });
    await startQuizEvaluation('s1', 'att-2');
    expect(mockRpc).toHaveBeenLastCalledWith('start_quiz_evaluation', { p_set: 's1', p_attempt: 'att-2' });
  });
  it('statut administrateur : le booléen renvoyé par la base, jamais autre chose', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    expect(await fetchIsPlatformAdmin()).toBe(true);
    mockRpc.mockResolvedValue({ data: null, error: null });
    expect(await fetchIsPlatformAdmin()).toBe(false);
    mockRpc.mockResolvedValue({ data: 'true', error: null });
    expect(await fetchIsPlatformAdmin()).toBe(false);
  });
  it('écritures : arguments des RPC', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await setCatalogDates('z1', '2026-09-07', '2026-09-13');
    expect(mockRpc).toHaveBeenLastCalledWith('catalog_set_dates', { p_quiz: 'z1', p_release: '2026-09-07', p_due: '2026-09-13' });
    await upsertCatalogQuestion({ id: 'q1', quizId: 'z1', position: 2, prompt: 'Q', choices: ['a', 'b', 'c'], correct: 1, explanation: null, source: null });
    expect(mockRpc).toHaveBeenLastCalledWith('catalog_upsert_question', { p_id: 'q1', p_quiz: 'z1', p_position: 2, p_prompt: 'Q', p_choices: ['a', 'b', 'c'], p_correct: 1, p_explanation: '', p_source: '' });
    await confirmCatalogAnswers('z1', [{ question_id: 'q1', correct: 2 }]);
    expect(mockRpc).toHaveBeenLastCalledWith('catalog_confirm_answers', { p_quiz: 'z1', p_answers: [{ question_id: 'q1', correct: 2 }] });
    await setChildClass('c1', 'VN', '5');
    expect(mockRpc).toHaveBeenLastCalledWith('set_child_class', { p_child: 'c1', p_country: 'VN', p_grade: '5' });
    await shiftChildSubject('c1', 'maths', -1);
    expect(mockRpc).toHaveBeenLastCalledWith('shift_child_subject', { p_child: 'c1', p_subject: 'maths', p_delta: -1 });
  });
  it('une erreur de la base est remontée (jamais avalée)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'forbidden', code: '42501' } });
    await expect(setCatalogDates('z1', null, null)).rejects.toMatchObject({ message: 'forbidden' });
  });
});

describe('Détail d\'une tentative du catalogue (parent)', () => {
  const attempt = { id: 'a1', child_id: 'c1', family_id: 'f', set_id: null, catalog_id: 'z1', status: 'submitted', created_at: 'x', updated_at: 'x', started_at: 'x', submitted_at: 'x', validated_at: null, validated_by: null, relaunched_by: null, show_correction: false, quiz_results: [{ score: 2, total: 3 }] };
  it('passe par parent_attempt_review (réponses d\'une tentative ENVOYÉE) et non par les tables de clés', async () => {
    mockMaybeSingle.mockResolvedValue({ data: attempt, error: null });
    mockRpc.mockResolvedValue({
      data: { title: 'Phân số', questions: [{ question_id: 'q1', position: 0, number: null, needs_figure: false, prompt: 'Q1', choices: ['a', 'b', 'c'], correct_index: 1, explanation: 'x', choice_index: 0, is_correct: false }] },
      error: null,
    });
    const detail = await fetchAttemptDetail('a1');
    expect(mockRpc).toHaveBeenCalledWith('parent_attempt_review', { p_attempt: 'a1' });
    expect(detail).toMatchObject({ title: 'Phân số', set: null, attempt: { score: 2, total: 3 } });
    expect(detail?.questions[0]).toMatchObject({ id: 'q1', correct_index: 1, choice_index: 0, is_correct: false });
  });
  it('tentative non envoyée : rien à montrer (jamais de clé avant l\'envoi)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { ...attempt, status: 'in_progress' }, error: null });
    mockRpc.mockResolvedValue({ data: null, error: { message: 'not_submitted' } });
    expect(await fetchAttemptDetail('a1')).toBeNull();
  });
});

describe('Suppression définitive d\'un QCM du catalogue (D-091)', () => {
  it('impact : RPC catalog_quiz_impact, compteurs lus tels que le serveur les compte', async () => {
    mockRpc.mockResolvedValue({ data: { quiz_id: 'z1', title: 'Ngữ văn 7', subject: 'langue_nationale', country: 'VN', grade: '7', week_label: 'Tuần 7', status: 'published', families: 2, children: 3, attempts: 3, in_progress: 1, submitted: 1, validated: 1, points: 8, questions: 12, answers: 20 }, error: null });
    const impact = await fetchCatalogQuizImpact('z1');
    expect(mockRpc).toHaveBeenCalledWith('catalog_quiz_impact', { p_quiz: 'z1' });
    expect(impact).toMatchObject({ title: 'Ngữ văn 7', children: 3, attempts: 3, validated: 1, points: 8 });
  });
  it('purge : RPC catalog_purge_quiz avec le titre saisi comme confirmation (la base compare)', async () => {
    mockRpc.mockResolvedValue({ data: { purged: true, title: 'Ngữ văn 7', families: 2, children: 3, attempts: 3, validated: 1, points: 8, questions: 12 }, error: null });
    const result = await purgeCatalogQuiz('z1', 'Ngữ văn 7');
    expect(mockRpc).toHaveBeenCalledWith('catalog_purge_quiz', { p_quiz: 'z1', p_confirm: 'Ngữ văn 7' });
    expect(result).toEqual({ purged: true, title: 'Ngữ văn 7', counts: { families: 2, children: 3, attempts: 3, validated: 1, points: 8, questions: 12 } });
  });
  it('rejeu : un QCM déjà supprimé répond purged:false, sans erreur', async () => {
    mockRpc.mockResolvedValue({ data: { purged: false }, error: null });
    expect((await purgeCatalogQuiz('z1', 'x')).purged).toBe(false);
  });
  it('mauvais titre ou non administrateur : l\'erreur du serveur est remontée telle quelle (code lu par l\'écran)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'confirm_mismatch', code: 'P0001' } });
    await expect(purgeCatalogQuiz('z1', 'faux')).rejects.toMatchObject({ message: 'confirm_mismatch' });
    mockRpc.mockResolvedValue({ data: null, error: { message: 'forbidden', code: '42501' } });
    await expect(fetchCatalogQuizImpact('z1')).rejects.toMatchObject({ message: 'forbidden' });
  });
});
