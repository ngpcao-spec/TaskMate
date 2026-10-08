import { expect, test, type Page } from '@playwright/test';
import { accessTokenOf, createFamily, createGoogleParent, directSignIn, internalEmailOf, resetAttempts, revokeChildMembers, serviceClient, seedTask, taskChildId, serverState, signInContext, supabaseUrl } from './support/seed';

const title = (label: string) => `${label} ${Math.random().toString(36).slice(2, 7)}`;

/** Diagnostic : journalise les réponses Supabase en erreur et les erreurs console (visible dans la sortie CI). */
function trace(page: Page, who: string): Promise<void> {
  let markSubscribed: () => void = () => undefined;
  const subscribed = new Promise<void>((resolve) => {
    markSubscribed = resolve;
  });
  page.on('response', async (res) => {
    if (res.status() >= 400 && res.url().includes('/rest/v1/')) console.log(`[${who}] ${res.status()} ${res.request().method()} ${res.url().replace(/^.*\/rest\/v1\//, '')} ${(await res.text().catch(() => '')).slice(0, 300)}`);
  });
  page.on('console', (m) => {
    if (m.type() === 'error') console.log(`[${who}] console.error ${m.text().slice(0, 300)}`);
  });
  page.on('websocket', (ws) => {
    console.log(`[${who}] ws ouvert ${ws.url().replace(/apikey=[^&]+/, 'apikey=…')}`);
    ws.on('framereceived', (f) => {
      const text = String(f.payload);
      if (text.includes('Subscribed to PostgreSQL')) markSubscribed();
      if (/postgres_changes|phx_reply|"system"|error/.test(text)) console.log(`[${who}] ws ← ${text.slice(0, 220)}`);
    });
  });
  page.on('pageerror', (e) => console.log(`[${who}] pageerror ${e.message.slice(0, 300)}`));
  return subscribed;
}

/** Diagnostic CI : si l'attente échoue, journalise l'URL et le texte de la page avant de relancer l'erreur. */
async function expectVisibleOrDump(page: Page, locator: ReturnType<Page['getByLabel']>, who: string, timeout = 20_000) {
  try {
    await expect(locator).toBeVisible({ timeout });
  } catch (e) {
    console.log(`[${who}] introuvable — url=${page.url()} texte=${(await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 600)}`);
    throw e;
  }
}

/** Connexion d'un enfant sur « son téléphone » : e-mail d'un parent de la famille + identifiant + mot de passe. */
async function childSignIn(browser: import('@playwright/test').Browser, parentEmail: string, loginId: string, password: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await open(page);
  await page.getByRole('button', { name: 'Bắt đầu' }).click();
  await page.getByRole('button', { name: 'Tôi là con' }).click();
  await page.getByLabel('Email của một phụ huynh trong gia đình').fill(parentEmail);
  await page.getByLabel('Tên đăng nhập', { exact: true }).fill(loginId);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  return page;
}
const WRONG_LOGIN = 'Không đăng nhập được: hãy kiểm tra email của phụ huynh, tên đăng nhập và mật khẩu.';

async function open(page: Page, path = '/') {
  await page.goto(path);
}

test.describe('validation parentale (spec v4)', () => {
  test('le parent crée une tâche, l\'enfant coche, le parent valide, les points sont crédités une fois', async ({ browser }) => {
    test.setTimeout(120_000);
    const family = await createFamily();
    const taskTitle = title('Đọc sách');

    // 1. parent : crée la tâche via l'interface
    const parentCtx = await browser.newContext();
    await signInContext(parentCtx, family.parent);
    const parent = await parentCtx.newPage();
    const parentSubscribed = trace(parent, 'parent');
    await open(parent);
    await expect(parent.getByText('Chào Minh!')).toBeVisible();
    await parent.getByRole('button', { name: 'Thêm việc' }).click();
    await parent.getByLabel('Tên công việc').fill(taskTitle);
    await parent.getByRole('button', { name: 'Lưu' }).click();
    await expect(parent.getByRole('checkbox', { name: taskTitle })).toBeVisible();

    // le canal Realtime du parent doit être abonné AVANT que l'enfant coche (sinon l'évènement est manqué, abonnement parfois lent en CI)
    await Promise.race([parentSubscribed, new Promise((resolve) => setTimeout(resolve, 20_000))]);

    // 2. enfant : coche → « Chờ duyệt », aucun point
    const childCtx = await browser.newContext();
    await signInContext(childCtx, family.minh);
    const child = await childCtx.newPage();
    trace(child, 'enfant');
    await open(child);
    const box = child.getByRole('checkbox', { name: taskTitle });
    await expect(box).toBeVisible();
    await box.click();
    await expect(box).toBeChecked();
    await expect(child.getByText('Chờ duyệt').first()).toBeVisible();
    await expect.poll(async () => (await serverState(family, 'minh', taskTitle)).completed).toBe(true);
    expect(await serverState(family, 'minh', taskTitle)).toMatchObject({ validated: false, balance: 0, transactions: 0 });
    await open(child, '/more/points');
    await expect(child.getByLabel('0 điểm', { exact: true })).toBeVisible();
    await expect(child.getByText('+10 điểm chờ duyệt')).toBeVisible();

    // 3. parent : la bannière « 1 việc chờ duyệt » apparaît (Realtime, sans recharger) puis valide depuis la file « Cần duyệt »
    await expectVisibleOrDump(parent, parent.getByRole('button', { name: '1 việc chờ duyệt' }), 'parent', 15_000);
    await parent.getByRole('button', { name: '1 việc chờ duyệt' }).click({ timeout: 15_000 });
    await expect(parent).toHaveURL(/\/approvals/);
    await parent.getByRole('button', { name: `Duyệt ${taskTitle}` }).click();
    await expect.poll(async () => (await serverState(family, 'minh', taskTitle)).validated).toBe(true);
    expect(await serverState(family, 'minh', taskTitle)).toMatchObject({ balance: 10, transactions: 1 }); // crédité une seule fois

    // 4. enfant : le solde apparaît
    await open(child, '/more/points');
    await expect(child.getByLabel('10 điểm', { exact: true })).toBeVisible();
  });

  test('l\'enfant hors ligne : la coche reste « Chờ duyệt » puis part une seule fois au retour du réseau', async ({ browser }) => {
    const family = await createFamily();
    const taskTitle = title('Dọn phòng');
    await seedTask(family, 'minh', taskTitle);

    const ctx = await browser.newContext();
    await signInContext(ctx, family.minh);
    const page = await ctx.newPage();
    trace(page, 'enfant-hors-ligne');
    await open(page);
    const box = page.getByRole('checkbox', { name: taskTitle });
    await expect(box).toBeVisible();

    await ctx.setOffline(true);
    await box.click();
    await expect(box).toBeChecked(); // effet local immédiat, jamais de point côté enfant
    await expect(page.getByText('Chờ duyệt').first()).toBeVisible();
    expect((await serverState(family, 'minh', taskTitle)).completed).toBe(false); // rien n'est parti

    await ctx.setOffline(false);
    await expect.poll(async () => (await serverState(family, 'minh', taskTitle)).completed, { timeout: 30_000 }).toBe(true);
    expect(await serverState(family, 'minh', taskTitle)).toMatchObject({ validated: false, balance: 0, transactions: 0 });
  });
});

test.describe('formulaire de tâche sur le web', () => {
  test('le parent modifie la date, l\'heure de début et l\'heure de fin (champs natifs du navigateur)', async ({ browser }) => {
    const family = await createFamily();
    const taskTitle = title('Piano');
    const ctx = await browser.newContext();
    await signInContext(ctx, family.parent);
    const page = await ctx.newPage();
    trace(page, 'parent-heures');
    await open(page);
    await page.getByRole('button', { name: 'Thêm việc' }).click();
    await page.getByLabel('Tên công việc').fill(taskTitle);
    await page.getByRole('button', { name: /^Thời gian/ }).click();
    await page.getByRole('radio', { name: 'Khoảng giờ' }).click();

    const date = page.getByLabel('Ngày', { exact: true });
    const from = page.getByLabel('Từ', { exact: true });
    const to = page.getByLabel('Đến', { exact: true });
    await expect(to).toHaveAttribute('type', 'time');
    await date.fill('2031-08-15');
    await from.fill('09:00');
    await to.fill('10:30');
    await expect(to).toHaveValue('10:30');

    // fin avant le début : erreur affichée, enregistrement bloqué
    await to.fill('08:00');
    await expect(page.getByText('Giờ kết thúc phải sau giờ bắt đầu')).toBeVisible();
    await to.fill('10:30');
    await expect(page.getByText('Giờ kết thúc phải sau giờ bắt đầu')).toHaveCount(0);

    await page.getByRole('button', { name: 'Lưu' }).click();
    await expect
      .poll(async () => {
        const { data } = await serviceClient().from('tasks').select('date, start_time, end_time').eq('family_id', family.familyId).eq('title', taskTitle).maybeSingle();
        return data ? `${data.date} ${String(data.start_time).slice(0, 5)}-${String(data.end_time).slice(0, 5)}` : null;
      })
      .toBe('2031-08-15 09:00-10:30');
  });
});

test.describe('renouveler une tâche (D-054)', () => {
  const taskDates = async (family: Awaited<ReturnType<typeof createFamily>>, taskTitle: string) => {
    const { data } = await serviceClient().from('tasks').select('date, child_id, completed_at, recurrence_id').eq('family_id', family.familyId).eq('title', taskTitle).is('deleted_at', null).order('date');
    return data ?? [];
  };
  const openRenew = async (page: Page, taskTitle: string) => {
    await open(page);
    await page.getByRole('button', { name: new RegExp(taskTitle) }).first().click();
    await page.getByRole('button', { name: 'Nhân bản / Lặp lại' }).click();
    await expect(page.getByText('Lặp lại công việc')).toBeVisible();
  };

  test('dupliquer sur deux jours précis : deux tâches ponctuelles « à faire », la source intacte', async ({ browser }) => {
    test.setTimeout(120_000);
    const family = await createFamily();
    const taskTitle = title('Rửa bát');
    await seedTask(family, 'minh', taskTitle);
    const ctx = await browser.newContext();
    await signInContext(ctx, family.parent);
    const page = await ctx.newPage();
    trace(page, 'parent-dupliquer');
    await openRenew(page, taskTitle);

    // jours cochables du calendrier (les jours passés sont désactivés) : aujourd'hui = la source (déjà occupé), puis les deux suivants
    const days = page.locator('[role="checkbox"]:not([aria-disabled="true"])').filter({ hasText: /^\d{1,2}$/ });
    await days.nth(1).click();
    await days.nth(2).click();
    await expect(page.getByText(/^Sẽ tạo 2 việc/)).toBeVisible();
    await page.getByRole('button', { name: 'Tạo' }).click();

    await expect.poll(async () => (await taskDates(family, taskTitle)).length).toBe(3);
    const rows = await taskDates(family, taskTitle);
    expect(new Set(rows.map((r) => r.date)).size).toBe(3);
    expect(rows.every((r) => r.child_id === family.minh.childId && r.recurrence_id === null)).toBe(true);
    expect(rows.filter((r) => r.completed_at !== null)).toHaveLength(0);
  });

  test('série hebdomadaire sur 4 semaines : une récurrence au bon jour ISO avec fin, occurrences générées', async ({ browser }) => {
    test.setTimeout(120_000);
    const family = await createFamily();
    const taskTitle = title('Tập đàn');
    await seedTask(family, 'minh', taskTitle);
    const ctx = await browser.newContext();
    await signInContext(ctx, family.parent);
    const page = await ctx.newPage();
    trace(page, 'parent-serie');
    await openRenew(page, taskTitle);

    await page.getByRole('radio', { name: 'Hằng tuần' }).click();
    await expect(page.getByText('4 tuần')).toBeVisible(); // valeur par défaut claire : 4 semaines
    await page.getByRole('button', { name: 'Tạo' }).click();

    await expect
      .poll(async () => {
        const { data } = await serviceClient().from('recurrences').select('weekdays, starts_on, ends_on').eq('family_id', family.familyId).eq('title', taskTitle);
        return data?.length ?? 0;
      })
      .toBe(1);
    const { data: rec } = await serviceClient().from('recurrences').select('id, weekdays, starts_on, ends_on').eq('family_id', family.familyId).eq('title', taskTitle).single();
    const { data: seed } = await serviceClient().from('tasks').select('date').eq('family_id', family.familyId).eq('title', taskTitle).is('recurrence_id', null).single();
    const isoOf = (date: string) => { const js = new Date(`${date}T00:00:00Z`).getUTCDay(); return js === 0 ? 7 : js; };
    expect(rec?.weekdays).toEqual([isoOf(seed?.date as string)]); // le jour de la source, jamais décalé d'un jour
    expect(Math.round((Date.parse(`${rec?.ends_on}T00:00:00Z`) - Date.parse(`${rec?.starts_on}T00:00:00Z`)) / 86_400_000)).toBe(27); // 4 semaines complètes
    const generated = (await taskDates(family, taskTitle)).filter((r) => r.recurrence_id === rec?.id);
    expect(generated.length).toBeGreaterThanOrEqual(1);
    expect(generated.every((r) => isoOf(r.date) === (rec?.weekdays as number[])[0])).toBe(true);
  });

  test('l\'enfant n\'a ni le bouton ni l\'écran « Renouveler »', async ({ browser }) => {
    const family = await createFamily();
    const taskTitle = title('Đọc sách');
    const id = await seedTask(family, 'minh', taskTitle);
    const ctx = await browser.newContext();
    await signInContext(ctx, family.minh);
    const page = await ctx.newPage();
    await open(page);
    await page.getByRole('button', { name: new RegExp(taskTitle) }).first().click();
    await expect(page).toHaveURL(/\/task\//); // le détail en lecture seule est ouvert
    await expect(page.getByRole('button', { name: 'Nhân bản / Lặp lại' })).toHaveCount(0);
    await open(page, `/task/renew?id=${id}`);
    await expect(page.getByText('Lặp lại công việc')).toHaveCount(0);
  });
});

test.describe('révisions (D-055)', () => {
  test('le parent crée et publie, l\'enfant passe l\'évaluation (un seul parcours), le parent valide sans correction, relance, valide avec correction', async ({ browser }) => {
    test.setTimeout(240_000);
    const family = await createFamily();
    const setTitle = title('Phân số');

    // 1. parent : crée un jeu (2 questions) pour Minh et le publie
    const parentCtx = await browser.newContext();
    await signInContext(parentCtx, family.parent);
    const parent = await parentCtx.newPage();
    trace(parent, 'parent-revisions');
    await open(parent, '/more/revisions');
    await parent.getByRole('button', { name: 'Tạo bộ câu hỏi' }).click();
    await parent.getByLabel('Tiêu đề').fill(setTitle);
    await parent.getByRole('button', { name: 'Tạo', exact: true }).click();
    const addQuestion = async (prompt: string, choices: string[], correct: number) => {
      await parent.getByRole('button', { name: 'Thêm câu hỏi' }).click();
      await parent.getByLabel('Nội dung câu hỏi').fill(prompt);
      for (const [i, c] of choices.entries()) await parent.getByLabel(`Lựa chọn ${i + 1}`, { exact: true }).fill(c);
      await parent.getByRole('radio', { name: `Đáp án đúng: lựa chọn ${correct}` }).click();
      await parent.getByRole('button', { name: 'Lưu câu hỏi' }).click();
      await expect(parent.getByText(prompt)).toBeVisible();
    };
    await addQuestion('1 + 1 = ?', ['1', '2', '3'], 2);
    await addQuestion('2 + 2 = ?', ['3', '4', '5'], 2);
    await parent.getByRole('button', { name: 'Đăng cho bạn ấy' }).click();
    await expect(parent.getByRole('button', { name: 'Gỡ xuống' })).toBeVisible();

    // 2. Khang (l'autre enfant) ne voit rien ; Minh voit son jeu
    const khangCtx = await browser.newContext();
    await signInContext(khangCtx, family.khang);
    const khang = await khangCtx.newPage();
    await open(khang, '/more/revisions');
    await expect(khang.getByText('Chưa có bộ câu hỏi nào để ôn tập.')).toBeVisible();
    await expect(khang.getByText(setTitle)).toHaveCount(0);

    const childCtx = await browser.newContext();
    await signInContext(childCtx, family.minh);
    const child = await childCtx.newPage();
    trace(child, 'enfant-revisions');
    await open(child, '/more/revisions');
    await child.getByRole('button', { name: new RegExp(setTitle) }).click();

    // 3. un seul parcours : aucun mode entraînement, aucun retour par question, aucun score
    await expect(child.getByRole('button', { name: 'Luyện tập', exact: true })).toHaveCount(0);
    await child.getByRole('button', { name: 'Làm bài kiểm tra' }).click();
    await child.getByRole('radio', { name: '2', exact: true }).click(); // juste (l'ordre et les choix sont mélangés par le serveur)
    await child.getByRole('radio', { name: '5', exact: true }).click(); // faux
    await expect(child.getByText('Đúng rồi!')).toHaveCount(0);
    await expect(child.getByText('Chưa đúng')).toHaveCount(0);
    await expect(child.getByText(/Đáp án đúng/)).toHaveCount(0);
    await child.getByRole('button', { name: 'Nộp bài' }).click();
    await expect(child.getByRole('heading', { name: 'Đã nộp, chờ phụ huynh duyệt' }).filter({ visible: true }).first()).toBeVisible();
    await expect(child.getByText(/Điểm:/)).toHaveCount(0);
    await expect
      .poll(async () => {
        const { data } = await serviceClient().from('quiz_attempts').select('id, status').eq('family_id', family.familyId);
        return data?.map((a) => a.status).join(',');
      })
      .toBe('submitted');
    const { data: attempt } = await serviceClient().from('quiz_attempts').select('id').eq('family_id', family.familyId).single();
    const { data: score } = await serviceClient().from('quiz_results').select('score, total').eq('attempt_id', attempt?.id as string).single();
    expect(score).toMatchObject({ score: 1, total: 2 }); // calculé par le serveur

    // l'enfant ne peut pas relancer seul une évaluation ; il voit toujours l'attente
    await open(child, '/more/revisions');
    await child.getByRole('button', { name: new RegExp(setTitle) }).click();
    await expect(child.getByRole('heading', { name: 'Đã nộp, chờ phụ huynh duyệt' })).toBeVisible();
    await expect(child.getByRole('button', { name: 'Làm bài kiểm tra' })).toHaveCount(0);

    // 4. parent : relit le détail puis valide, correction DÉSACTIVÉE (réglage par défaut)
    await open(parent, '/more/revisions');
    await parent.getByRole('button', { name: new RegExp(`${setTitle}, Chờ duyệt`) }).click();
    await expect(parent.getByRole('heading', { name: '1/2' })).toBeVisible();
    await expect(parent.getByText('Đáp án đúng: 4').filter({ visible: true })).toHaveCount(1);
    await parent.getByRole('button', { name: 'Duyệt kết quả' }).click();
    await expect.poll(async () => (await serviceClient().from('quiz_attempts').select('status, show_correction').eq('id', attempt?.id as string).single()).data).toMatchObject({ status: 'validated', show_correction: false });

    // 5. enfant : son score et la question ratée avec SA réponse, SANS bonne réponse
    await open(child, '/more/revisions');
    await child.getByRole('button', { name: new RegExp(setTitle) }).click();
    await child.getByRole('button', { name: 'Xem kết quả' }).click();
    await expect(child.getByRole('heading', { name: 'Điểm: 1/2' })).toBeVisible();
    await expect(child.getByText('2 + 2 = ?').filter({ visible: true })).toHaveCount(1);
    await expect(child.getByText('Bạn chọn: 5').filter({ visible: true })).toHaveCount(1);
    await expect(child.getByText(/Đáp án đúng/)).toHaveCount(0);

    // 6. le parent relance une tentative (historique conservé) ; l'enfant la repasse ; correction ACTIVÉE à la validation
    await open(parent, '/more/revisions');
    await parent.getByRole('button', { name: new RegExp(`${setTitle}`) }).first().click();
    await parent.getByRole('button', { name: 'Cho làm lại bài kiểm tra' }).click();
    await open(child, '/more/revisions');
    await child.getByRole('button', { name: new RegExp(setTitle) }).click();
    // la relance crée une tentative ouverte côté serveur : l'enfant la REPREND (il ne peut pas en démarrer une lui-même)
    await expect(child.getByRole('button', { name: 'Làm bài kiểm tra', exact: true })).toHaveCount(0);
    await child.getByRole('button', { name: 'Làm tiếp bài kiểm tra' }).click();
    await child.getByRole('radio', { name: '2', exact: true }).click();
    await child.getByRole('radio', { name: '5', exact: true }).click(); // faux (« 3 » existe dans les deux questions : sélecteur ambigu)
    await child.getByRole('button', { name: 'Nộp bài' }).click();
    await expect(child.getByRole('heading', { name: 'Đã nộp, chờ phụ huynh duyệt' }).filter({ visible: true }).first()).toBeVisible();
    await expect.poll(async () => (await serviceClient().from('quiz_attempts').select('status').eq('family_id', family.familyId).eq('status', 'submitted')).data?.length).toBe(1);
    const { data: second } = await serviceClient().from('quiz_attempts').select('id').eq('family_id', family.familyId).eq('status', 'submitted').single();
    await open(parent, `/quiz/attempt/${second?.id as string}`);
    await parent.getByLabel('Hiện đáp án đúng cho con').click();
    await parent.getByRole('button', { name: 'Duyệt kết quả' }).click();
    await expect.poll(async () => (await serviceClient().from('quiz_attempts').select('show_correction').eq('id', second?.id as string).single()).data?.show_correction).toBe(true);
    await open(child, '/more/revisions');
    await child.getByRole('button', { name: new RegExp(setTitle) }).click();
    await expect(child.getByRole('heading', { name: 'Tiến triển' })).toBeVisible(); // SA progression (accueil du jeu), résultats validés seulement
    await child.getByRole('button', { name: 'Xem kết quả' }).click();
    await expect(child.getByText('Đáp án đúng: 4').filter({ visible: true })).toHaveCount(1);
  });

  // La fonction `generate-questions` est SIMULÉE (aucun appel IA réel) : la requête du navigateur est interceptée, on vérifie ce qu'elle envoie,
  // et la réponse enregistre un brouillon comme le ferait le serveur (clé service du Supabase local).
  const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const summary = (setId: string, setTitle: string, over: Record<string, unknown> = {}) => ({
    set_id: setId, title: setTitle, count: 2, truncated: false, kind: 'course', kind_detected: true, kind_doubt: false, found: 2, capped: false, cap: 30,
    ignored: [], ignored_count: 0, to_verify_count: 0, figure_count: 0, free_retry: false, ...over,
  });
  type SeedRow = { prompt: string; choices: string[]; correct: number; number?: number; figure?: boolean; verify?: boolean; confirmed?: boolean };
  const PHOTO_ROWS: SeedRow[] = [
    { prompt: 'La photosynthèse a lieu dans ?', choices: ['les feuilles', 'les racines', 'le sol'], correct: 0 },
    { prompt: 'Que produit la plante ?', choices: ['du dioxygène', 'du fer', 'du sel'], correct: 0 },
  ];
  async function seedDraft(familyId: string, childId: string, memberId: string, setId: string, setTitle: string, opts: { kind?: 'exam' | 'exam_key' | 'course' | 'list'; detected?: boolean; rows?: SeedRow[] } = {}) {
    const db = serviceClient();
    await db.from('quiz_sets').insert({ id: setId, family_id: familyId, child_id: childId, title: setTitle, status: 'draft', created_by: memberId, material_kind: opts.kind ?? 'course', kind_detected: opts.detected ?? false });
    for (const [i, r] of (opts.rows ?? PHOTO_ROWS).entries()) {
      const { data } = await db.from('quiz_questions').insert({ set_id: setId, family_id: familyId, position: i, prompt: r.prompt, choices: r.choices, origin_number: r.number ?? null, needs_figure: r.figure ?? false }).select('id').single();
      await db.from('quiz_answer_keys').insert({ question_id: data?.id as string, family_id: familyId, correct_index: r.correct, to_verify: r.verify ?? r.figure ?? false, confirmed: r.confirmed ?? false });
    }
  }

  test('le parent charge un document : requête vérifiée, questions en BROUILLON, relecture puis publication (IA simulée)', async ({ browser }) => {
    test.setTimeout(180_000);
    const family = await createFamily();
    const ctx = await browser.newContext();
    await signInContext(ctx, family.parent);
    const page = await ctx.newPage();
    trace(page, 'parent-import');
    let sent: { childId: string; setId: string; kind: string; count: number | string; retry: boolean; instruction?: string; language: string; subject?: string; files: { mediaType: string; data: string; role: string }[] } | null = null;
    await page.route('**/functions/v1/generate-questions', async (route) => {
      const request = route.request();
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      sent = request.postDataJSON();
      await seedDraft(family.familyId, sent!.childId, family.parent.memberId as string, sent!.setId, 'La photosynthèse');
      await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify(summary(sent!.setId, 'La photosynthèse', { count: 2 })) });
    });

    await open(page, '/more/revisions');
    await page.getByRole('button', { name: 'Tạo từ tài liệu' }).click();
    await expect(page.getByText(/KHÔNG được lưu giữ/)).toBeVisible();

    // une photo (PNG) est redimensionnée / recompressée en JPEG avant l'envoi
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Chọn ảnh', exact: true }).click()]);
    await chooser.setFiles({ name: 'trang1.png', mimeType: 'image/png', buffer: Buffer.from(PNG_1X1, 'base64') });
    await expect(page.getByText('trang1.jpg')).toBeVisible();
    await page.getByLabel('Môn học (không bắt buộc)').fill('Sinh học');
    // PAR DÉFAUT : type « Tự động » et nombre « Số câu tự động » sélectionnés d'office, consigne vide
    await expect(page.getByRole('radio', { name: 'Tự động', exact: true })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radio', { name: 'Số câu tự động' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'Tạo câu hỏi', exact: true }).click();

    // le type détecté est affiché au parent, puis arrivée dans l'éditeur de relecture : brouillon, 2 questions, rien n'est publié
    await expect(page.getByRole('heading', { name: 'Phát hiện: bài học' })).toBeVisible();
    await page.getByRole('button', { name: 'Xem lại câu hỏi' }).click();
    await expect(page.getByText('1. La photosynthèse a lieu dans ?')).toBeVisible();
    await expect(page.getByText('2. Que produit la plante ?')).toBeVisible();
    expect(sent).toMatchObject({ childId: family.minh.childId, kind: 'auto', count: 'auto', retry: false, language: 'vi', subject: 'Sinh học' });
    expect(sent!.instruction).toBeUndefined(); // consigne vide par défaut
    expect(sent!.files).toHaveLength(1);
    expect(sent!.files[0]!.role).toBe('exam');
    expect(sent!.files[0]!.mediaType).toBe('image/jpeg');
    expect(sent!.files[0]!.data.startsWith('/9j/')).toBe(true); // JPEG
    const { data: draft } = await serviceClient().from('quiz_sets').select('status').eq('id', sent!.setId).single();
    expect(draft?.status).toBe('draft');

    // l'enfant ne voit rien tant que le parent n'a pas publié ; ensuite il voit le jeu
    const childCtx = await browser.newContext();
    await signInContext(childCtx, family.minh);
    const child = await childCtx.newPage();
    await open(child, '/more/revisions');
    await expect(child.getByText('Chưa có bộ câu hỏi nào để ôn tập.')).toBeVisible();
    await page.getByRole('button', { name: 'Đăng cho bạn ấy' }).click();
    await expect(page.getByRole('button', { name: 'Gỡ xuống' })).toBeVisible();
    await open(child, '/more/revisions');
    await expect(child.getByRole('button', { name: /La photosynthèse/ })).toBeVisible();
  });

  test('examen papier détecté : avertissements, grille Đáp án, publication REFUSÉE par le serveur tant que les réponses ne sont pas confirmées', async ({ browser }) => {
    test.setTimeout(240_000);
    const family = await createFamily();
    const ctx = await browser.newContext();
    await signInContext(ctx, family.parent);
    const page = await ctx.newPage();
    trace(page, 'parent-examen');
    const sentBodies: { setId: string; kind: string; count: number | string; retry: boolean; instruction?: string; files: { role: string }[] }[] = [];
    let setId = '';
    await page.route('**/functions/v1/generate-questions', async (route) => {
      const request = route.request();
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      const sent = request.postDataJSON();
      sentBodies.push(sent);
      setId = sent.setId;
      if (!sent.retry) {
        await seedDraft(family.familyId, sent.childId, family.parent.memberId as string, sent.setId, 'Examen de maths', {
          kind: 'exam', detected: true,
          rows: [
            { prompt: 'Limite de (x+1)/(x−2) en +∞ ?', choices: ['0', '1', '2', '+∞'], correct: 1, number: 5 },
            { prompt: 'D\'après la courbe, f est croissante sur ?', choices: ['[0;1]', '[1;2]', '[2;3]'], correct: 0, number: 6, figure: true },
            { prompt: 'Racine de x² = 9 ?', choices: ['3', '4', '9'], correct: 0, number: 7 },
          ],
        });
      }
      const kind = sent.kind === 'auto' ? 'exam' : sent.kind;
      await route.fulfill({
        status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json',
        body: JSON.stringify(summary(sent.setId, 'Examen de maths', { count: 3, kind, kind_detected: sent.kind === 'auto', found: 42, capped: true, ignored: ['Câu 13', 'Câu 14', 'Câu 15'], ignored_count: 3, figure_count: 1, to_verify_count: 1, free_retry: sent.retry })),
      });
    });

    await open(page, '/quiz/import');
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Chọn PDF hoặc Word', exact: true }).click()]);
    await chooser.setFiles({ name: 'de-thi.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj << /Type /Pages /Count 2 >> endobj') });
    await expect(page.getByText('de-thi.pdf')).toBeVisible();
    await page.getByLabel('Ghi chú cho AI (không bắt buộc)').fill('chỉ chương 2');
    await page.getByRole('button', { name: 'Tạo câu hỏi', exact: true }).click();

    // type détecté + avertissements : jamais de coupe ni d'omission silencieuse
    await expect(page.getByRole('heading', { name: 'Phát hiện: đề thi giấy' })).toBeVisible();
    await expect(page.getByText('Tìm thấy 42 câu trắc nghiệm, lấy 30 câu: hãy tạo lại để lấy các câu còn lại.')).toBeVisible();
    await expect(page.getByText('3 câu không phải trắc nghiệm đã bị bỏ qua: Câu 13, Câu 14, Câu 15')).toBeVisible();
    await expect(page.getByText('1 câu phụ thuộc hình hoặc bảng: hãy đối chiếu với đề giấy.')).toBeVisible();
    expect(sentBodies[0]).toMatchObject({ kind: 'auto', count: 'auto', retry: false, instruction: 'chỉ chương 2', files: [{ role: 'exam' }] });

    // corriger le type et relancer sur le MÊME brouillon (retry), sans reperdre de quota
    await page.getByRole('button', { name: 'Sửa loại tài liệu và tạo lại' }).click();
    await page.getByRole('radio', { name: 'Bài học / bài giảng' }).click();
    await page.getByRole('button', { name: 'Tạo lại với loại này' }).click();
    await expect(page.getByRole('heading', { name: 'Loại tài liệu: bài học' })).toBeVisible();
    expect(sentBodies[1]).toMatchObject({ setId: sentBodies[0]!.setId, kind: 'course', retry: true });
    await page.getByRole('button', { name: 'Sửa loại tài liệu và tạo lại' }).click();
    await page.getByRole('radio', { name: 'Đề thi / bài tập giấy' }).click();
    await page.getByRole('button', { name: 'Tạo lại với loại này' }).click();
    await expect(page.getByRole('heading', { name: 'Loại tài liệu: đề thi giấy' })).toBeVisible();
    await page.getByRole('button', { name: 'Mở bảng Đáp án' }).click();

    // grille Đáp án : numéros d'origine, lettres A à D, publication désactivée
    await expect(page.getByRole('heading', { name: 'Câu 5' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Câu 6' })).toBeVisible();
    await expect(page.getByText('Có hình / bảng trên đề giấy')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Đăng cho bạn ấy' })).toBeDisabled();

    // le SERVEUR refuse de publier (pas seulement l'interface), y compris pour un type détecté par l'IA
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(supabaseUrl(), process.env.E2E_ANON_KEY as string, { auth: { persistSession: false } });
    expect((await client.auth.signInWithPassword({ email: family.parent.email, password: family.parent.password })).error).toBeNull();
    expect((await client.rpc('set_quiz_status', { p_set: setId, p_status: 'published' })).error?.message).toBe('answers_to_verify');
    expect((await serviceClient().from('quiz_sets').select('status, material_kind, kind_detected').eq('id', setId).single()).data).toEqual({ status: 'draft', material_kind: 'exam', kind_detected: true });
    // …y compris quand la question signalée est confirmée mais pas les autres réponses de l'examen
    await page.getByRole('radio', { name: 'Câu 6: đáp án A' }).click();
    await page.getByRole('button', { name: 'Lưu xác nhận' }).click();
    await expect.poll(async () => (await serviceClient().from('quiz_answer_keys').select('confirmed').eq('family_id', family.familyId).eq('confirmed', true)).data?.length).toBe(1);
    expect((await client.rpc('set_quiz_status', { p_set: setId, p_status: 'published' })).error?.message).toBe('answers_not_confirmed');

    // le parent confirme les autres réponses (toucher la pastille = confirmer), enregistre, puis publie
    await page.getByRole('radio', { name: 'Câu 5: đáp án B' }).click();
    await page.getByRole('radio', { name: 'Câu 7: đáp án A' }).click();
    await page.getByRole('button', { name: 'Lưu xác nhận' }).click();
    await expect.poll(async () => (await serviceClient().from('quiz_answer_keys').select('confirmed').eq('family_id', family.familyId).eq('confirmed', true)).data?.length).toBe(3);
    await expect(page.getByRole('button', { name: 'Đăng cho bạn ấy' })).toBeEnabled();
    await page.getByRole('button', { name: 'Đăng cho bạn ấy' }).click();
    await expect.poll(async () => (await serviceClient().from('quiz_sets').select('status').eq('id', setId).single()).data?.status).toBe('published');

    // l'enfant voit le jeu publié ; il n'a AUCUNE voie vers la clé, les drapeaux ou la confirmation
    const childCtx = await browser.newContext();
    await signInContext(childCtx, family.minh);
    const child = await childCtx.newPage();
    await open(child, '/more/revisions');
    await expect(child.getByRole('button', { name: /Examen de maths/ })).toBeVisible();
    const childClient = createClient(supabaseUrl(), process.env.E2E_ANON_KEY as string, { auth: { persistSession: false } });
    expect((await childClient.auth.signInWithPassword({ email: family.minh.email, password: family.minh.password })).error).toBeNull();
    expect((await childClient.from('quiz_answer_keys').select('to_verify, confirmed, correct_index')).data).toEqual([]);
    expect((await childClient.from('quiz_questions').select('origin_number, needs_figure')).data).toEqual([]);
    expect((await childClient.rpc('confirm_quiz_answers', { p_set: setId, p_answers: [] })).error?.code).toBe('42501');
  });

  test('IA non configurée, quota atteint, document refusé : messages clairs, aucun jeu créé', async ({ browser }) => {
    test.setTimeout(120_000);
    const family = await createFamily();
    const ctx = await browser.newContext();
    await signInContext(ctx, family.parent);
    const page = await ctx.newPage();
    let reply: { status: number; body: Record<string, unknown> } = { status: 503, body: { error: 'ai_not_configured' } };
    await page.route('**/functions/v1/generate-questions', async (route) => {
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
      await route.fulfill({ status: reply.status, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify(reply.body) });
    });
    await open(page, '/quiz/import');
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Chọn PDF hoặc Word', exact: true }).click()]);
    await chooser.setFiles({ name: 'cours.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj << /Type /Pages /Count 2 >> endobj') });
    await expect(page.getByText('cours.pdf')).toBeVisible();
    await page.getByRole('button', { name: 'Tạo câu hỏi', exact: true }).click();
    await expect(page.getByText(/AI chưa được cấu hình/)).toBeVisible();
    reply = { status: 429, body: { error: 'quota_exceeded', limit: 20, used: 20 } };
    await page.getByRole('button', { name: 'Tạo câu hỏi', exact: true }).click();
    await expect(page.getByText('Đã hết lượt tạo hôm nay (20/20). Thử lại vào ngày mai.')).toBeVisible();
    reply = { status: 422, body: { error: 'no_usable_content' } };
    await page.getByRole('button', { name: 'Tạo câu hỏi', exact: true }).click();
    await expect(page.getByText('Không tìm thấy nội dung học tập trong tài liệu.')).toBeVisible();
    const { data } = await serviceClient().from('quiz_sets').select('id').eq('family_id', family.familyId);
    expect(data ?? []).toHaveLength(0);

    // un fichier d'un type non pris en charge est refusé côté navigateur, sans appel
    const [chooser2] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Chọn PDF hoặc Word', exact: true }).click()]);
    await chooser2.setFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('bonjour') });
    await expect(page.getByText(/Loại tệp không được hỗ trợ/)).toBeVisible();
  });

  test('un enfant n\'a aucun accès aux écrans parent des révisions', async ({ browser }) => {
    const family = await createFamily();
    const ctx = await browser.newContext();
    await signInContext(ctx, family.minh);
    const page = await ctx.newPage();
    await open(page, '/more/revisions');
    await expect(page.getByRole('button', { name: 'Tạo bộ câu hỏi' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: /tuổi/ })).toHaveCount(0);
    await open(page, '/quiz/new');
    await expect(page.getByText('Bộ câu hỏi mới')).toHaveCount(0);
  });
});

test.describe('droits de l\'enfant', () => {
  test('l\'enfant ne voit que ses données (D-052) et ne peut pas créer de tâche', async ({ browser }) => {
    const family = await createFamily();
    const khangTask = title('Tập đàn');
    await seedTask(family, 'khang', khangTask);

    const ctx = await browser.newContext();
    await signInContext(ctx, family.minh);
    const page = await ctx.newPage();
    await open(page);
    await expect(page.getByText('Chào Minh!')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Thêm việc' })).toHaveCount(0);

    // aucun sélecteur d'enfant, aucune trace du frère ni de sa tâche
    await expect(page.getByRole('tab', { name: /tuổi/ })).toHaveCount(0); // (la barre d'onglets de l'app n'est pas un sélecteur d'enfant)
    await expect(page.getByText(/Khang/)).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: khangTask })).toHaveCount(0);

    // route de création protégée
    await open(page, '/task/new');
    await expect(page.getByLabel('Tên công việc')).toHaveCount(0);
  });
});

test.describe('parents Google, famille partagée, enfants rattachés à la famille', () => {
  const LOGIN_FIELD = 'Tên đăng nhập (chữ, số, . _ -)';
  const PASSWORD_FIELD = 'Mật khẩu (tối thiểu 6 ký tự)';

  test('deux parents sur la même famille ; un enfant se connecte avec l\'e-mail du SECOND parent', async ({ browser }) => {
    test.setTimeout(240_000);
    const tag = Math.random().toString(36).slice(2, 8);
    const loginId = `bin.${tag}`;
    const parentA = await createGoogleParent('ba');
    const parentB = await createGoogleParent('me');
    const parentC = await createGoogleParent('co');

    // ── parent A (connexion Google simulée) : famille + enfant + compte enfant, depuis l'écran d'onboarding
    const ctxA = await browser.newContext();
    await signInContext(ctxA, parentA);
    const pageA = await ctxA.newPage();
    trace(pageA, 'parent-A');
    await open(pageA);
    await pageA.getByLabel('Tên gia đình').fill(`Gia đình ${tag}`);
    await pageA.getByLabel('Tên của bạn').fill('Ba');
    await pageA.getByRole('button', { name: 'Tạo gia đình' }).click();
    await expectVisibleOrDump(pageA, pageA.getByLabel('Tên của con'), 'parent-A');
    await pageA.getByLabel('Tên của con').fill('Bin');
    await pageA.getByLabel('Ngày sinh (YYYY-MM-DD)').fill('2012-05-01');
    await pageA.getByRole('button', { name: 'Thêm con' }).click();
    await pageA.getByLabel(LOGIN_FIELD).fill(loginId);
    await pageA.getByLabel(PASSWORD_FIELD).fill('abc123');
    await pageA.getByRole('button', { name: 'Tạo tài khoản Bin' }).click();
    await expect(pageA.getByText(`Tên đăng nhập: ${loginId}`)).toBeVisible({ timeout: 20_000 });
    await pageA.getByRole('button', { name: 'Hoàn tất' }).click();
    await expect(pageA.getByText('Chào Bin!')).toBeVisible({ timeout: 20_000 });

    // ── parent A invite un parent : code affiché une seule fois (haché en base)
    await open(pageA, '/more/settings');
    await pageA.getByRole('button', { name: 'Tạo mã' }).first().click();
    const codeLocator = pageA.locator('[aria-label^="Mã mời: "]');
    await expect(codeLocator).toBeVisible({ timeout: 20_000 });
    const code = (await codeLocator.innerText()).trim();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    await expect(pageA.getByText(/sẽ không hiển thị lại/)).toBeVisible();
    await open(pageA, '/more/settings'); // rechargé : le code n'est plus relisible
    await expect(pageA.getByText(code)).toHaveCount(0);
    await expect(pageA.getByText(/Không thể hiện lại mã/)).toBeVisible({ timeout: 20_000 });

    // ── parent B (Google simulé) : « Tham gia một gia đình » ; un mauvais code est refusé
    const ctxB = await browser.newContext();
    await signInContext(ctxB, parentB);
    const pageB = await ctxB.newPage();
    trace(pageB, 'parent-B');
    await open(pageB);
    await pageB.getByRole('button', { name: 'Tham gia một gia đình' }).click();
    await pageB.getByLabel('Mã mời').fill('ZZZZ-ZZZZ');
    await pageB.getByLabel('Tên của bạn').fill('Mẹ');
    await pageB.getByRole('button', { name: 'Tham gia gia đình' }).click();
    await expect(pageB.getByText('Mã không hợp lệ, đã hết hạn hoặc đã được dùng.')).toBeVisible({ timeout: 20_000 });
    await pageB.getByLabel('Mã mời').fill(code.toLowerCase());
    await pageB.getByRole('button', { name: 'Tham gia gia đình' }).click();
    // les mêmes enfants, sans rien refaire
    await expect(pageB.getByText('Chào Bin!')).toBeVisible({ timeout: 20_000 });

    // ── le code est à usage unique : un troisième parent est refusé
    const ctxC = await browser.newContext();
    await signInContext(ctxC, parentC);
    const pageC = await ctxC.newPage();
    await open(pageC);
    await pageC.getByRole('button', { name: 'Tham gia một gia đình' }).click();
    await pageC.getByLabel('Mã mời').fill(code);
    await pageC.getByLabel('Tên của bạn').fill('Cô');
    await pageC.getByRole('button', { name: 'Tham gia gia đình' }).click();
    await expect(pageC.getByText('Mã không hợp lệ, đã hết hạn hoặc đã được dùng.')).toBeVisible({ timeout: 20_000 });

    // ── l'enfant se connecte avec l'e-mail du SECOND parent (e-mail de n'importe quel parent de la famille)
    const child = await childSignIn(browser, parentB.email, loginId, 'abc123');
    await expect(child.getByText('Chào Bin!')).toBeVisible({ timeout: 20_000 });
    // l'enfant ne voit aucun écran parent
    await open(child, '/more/add-child');
    await expect(child.getByLabel('Tên của con')).toHaveCount(0);

    // ── message identique quel que soit le champ faux (e-mail, identifiant, mot de passe)
    for (const [email, id, pw] of [
      ['inconnu@e2e.test', loginId, 'abc123'],
      [parentB.email, 'fantome', 'abc123'],
      [parentB.email, loginId, 'mauvais1'],
    ] as const) {
      const bad = await childSignIn(browser, email, id, pw);
      await expect(bad.getByText(WRONG_LOGIN)).toBeVisible({ timeout: 20_000 });
    }

    // ── les deux parents voient les mêmes enfants et peuvent tous deux gérer l'accès
    await pageB.getByRole('tab', { name: /Thêm/ }).click();
    await expect(pageB.getByRole('radio', { name: /^Bin,/ })).toBeVisible({ timeout: 20_000 });
    await open(pageB, '/more/children');
    await pageB.getByLabel('Mật khẩu mới').fill('nouveau1');
    await pageB.getByRole('button', { name: 'Đổi mật khẩu Bin' }).click();
    await expect(pageB.getByText('Đã đổi mật khẩu')).toBeVisible({ timeout: 20_000 });
    const oldPw = await childSignIn(browser, parentA.email, loginId, 'abc123');
    await expect(oldPw.getByText(WRONG_LOGIN)).toBeVisible({ timeout: 20_000 });
    const newPw = await childSignIn(browser, parentA.email, loginId, 'nouveau1');
    await expect(newPw.getByText('Chào Bin!')).toBeVisible({ timeout: 20_000 });

    // ── le parent B quitte la famille ; le parent A, devenu seul parent, ne peut plus « quitter »
    await open(pageB, '/more/settings');
    pageB.once('dialog', (d) => void d.accept());
    await pageB.getByRole('button', { name: 'Rời gia đình' }).click();
    await expect(pageB.getByRole('button', { name: 'Tạo gia đình' })).toBeVisible({ timeout: 20_000 });
    await open(pageA, '/more/settings');
    await expect(pageA.getByText(/Bạn là phụ huynh duy nhất/)).toBeVisible({ timeout: 20_000 });
    await expect(pageA.getByRole('button', { name: 'Rời gia đình' })).toHaveCount(0);
  });

  test('« tên đăng nhập đã có người dùng » : unique dans la FAMILLE seulement', async ({ browser }) => {
    const tag = Math.random().toString(36).slice(2, 8);
    const family = await createFamily();
    await revokeChildMembers(family); // profils sans compte de connexion
    const ctx = await browser.newContext();
    await signInContext(ctx, family.parent);
    const page = await ctx.newPage();
    await open(page, '/more/children');
    // premier enfant (Minh) : compte créé ; second (Khang) : même identifiant refusé
    await page.getByLabel(LOGIN_FIELD).first().fill(`dup.${tag}`);
    await page.getByLabel(PASSWORD_FIELD).first().fill('abc123');
    await page.getByRole('button', { name: 'Tạo tài khoản Minh' }).click();
    await expect(page.getByText(`Tên đăng nhập: dup.${tag}`)).toBeVisible({ timeout: 20_000 });
    await page.getByLabel(LOGIN_FIELD).fill(`dup.${tag}`);
    await page.getByLabel(PASSWORD_FIELD).fill('abc123');
    await page.getByRole('button', { name: 'Tạo tài khoản Khang' }).click();
    await expect(page.getByText('Tên đăng nhập này đã có người dùng. Hãy chọn tên khác.')).toBeVisible({ timeout: 20_000 });
  });

  test('le MÊME identifiant existe dans deux familles ; chaque enfant se connecte avec l\'e-mail de SA famille', async ({ browser }) => {
    test.setTimeout(120_000);
    const loginId = `meme.${Math.random().toString(36).slice(2, 7)}`;
    const families = [await createFamily(), await createFamily()];
    for (const family of families) {
      await revokeChildMembers(family);
      const token = await accessTokenOf(family.parent);
      const res = await fetch(`${supabaseUrl()}/functions/v1/create-child`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: process.env.E2E_ANON_KEY as string, Authorization: `Bearer ${token}` },
        body: JSON.stringify({ childId: family.minh.childId, loginId, password: 'abc123' }),
      });
      expect(res.status).toBe(200); // même identifiant dans les deux familles : accepté
    }
    for (const family of families) {
      const page = await childSignIn(browser, family.parent.email, loginId, 'abc123');
      await expect(page.getByText('Chào Minh!')).toBeVisible({ timeout: 20_000 });
    }
    // l'e-mail d'une AUTRE famille ne donne pas accès à ce compte-ci (mauvais mot de passe là-bas)
    const cross = await childSignIn(browser, families[0]!.parent.email, loginId, 'autre-mdp');
    await expect(cross.getByText(WRONG_LOGIN)).toBeVisible({ timeout: 20_000 });
  });

  test('un enfant ne peut ni inviter, ni créer, ni modifier, ni supprimer un compte', async () => {
    const family = await createFamily();
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(supabaseUrl(), process.env.E2E_ANON_KEY as string, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInWithPassword({ email: family.minh.email, password: family.minh.password });
    expect(error).toBeNull();
    const call = async (fn: string, body: Record<string, unknown>) => {
      const res = await fetch(`${supabaseUrl()}/functions/v1/${fn}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: process.env.E2E_ANON_KEY as string, Authorization: `Bearer ${data.session?.access_token}` },
        body: JSON.stringify(body),
      });
      return { status: res.status, body: (await res.json()) as { error?: string } };
    };
    const childId = family.khang.childId as string;
    expect(await call('create-child', { childId, loginId: 'pirate.khang', password: 'abc123' })).toMatchObject({ status: 403, body: { error: 'forbidden' } });
    expect(await call('reset-child-password', { childId, password: 'abc123' })).toMatchObject({ status: 403, body: { error: 'forbidden' } });
    expect(await call('delete-child', { childId })).toMatchObject({ status: 403, body: { error: 'forbidden' } });
    // invitations : RPC refusées à un enfant
    expect((await client.rpc('create_parent_invite')).error?.code).toBe('42501');
    expect((await client.rpc('revoke_parent_invite')).error?.code).toBe('42501');
    expect((await client.rpc('leave_family')).error?.code).toBe('42501');
    expect((await client.from('parent_invites').select('id')).data).toEqual([]);
  });

  test('inscription réservée à Google : un compte e-mail ordinaire ne peut ni créer ni rejoindre une famille', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const admin = createClient(supabaseUrl(), process.env.E2E_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } });
    const email = `mail-${Math.random().toString(36).slice(2, 8)}@e2e.test`;
    await admin.auth.admin.createUser({ email, password: 'Pw-mail-1!', email_confirm: true });
    const client = createClient(supabaseUrl(), process.env.E2E_ANON_KEY as string, { auth: { persistSession: false } });
    const { error } = await client.auth.signInWithPassword({ email, password: 'Pw-mail-1!' });
    expect(error).toBeNull();
    expect((await client.rpc('create_family', { p_name: 'X', p_display_name: 'Y' })).error?.message).toBe('google_required');
    expect((await client.rpc('join_family_with_code', { p_code: 'ABCD2345', p_display_name: 'Y' })).error?.message).toBe('google_required');
  });
});

test.describe('comptes enfants : aucune connexion directe, child-login seul', () => {
  const UUID_EMAIL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@child\.taskmate\.invalid$/;
  const childLoginRequest = async (parentEmail: string, loginId: string, password: string) => {
    const res = await fetch(`${supabaseUrl()}/functions/v1/child-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: process.env.E2E_ANON_KEY as string, 'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 200) + 1}` },
      body: JSON.stringify({ parentEmail, loginId, password }),
    });
    return { status: res.status, body: (await res.json()) as { session?: { access_token: string; refresh_token: string }; error?: string } };
  };

  test('un ancien compte (adresse devinable) est migré : connexion directe impossible, child-login fonctionne avec le même mot de passe', async ({ browser }) => {
    test.setTimeout(120_000);
    const family = await createFamily();
    await revokeChildMembers(family);
    const db = serviceClient();
    const tag = Math.random().toString(36).slice(2, 8);
    const loginId = `ancien.${tag}`;
    const guessable = `${loginId}@child.taskmate.invalid`;

    // état « avant migration » : adresse devinable ET mot de passe connu de GoTrue ; pas de haché
    const created = await db.auth.admin.createUser({ email: guessable, password: 'abc123', email_confirm: true, app_metadata: { account_type: 'child' } });
    expect(created.error).toBeNull();
    const userId = created.data.user?.id as string;
    const member = await db.from('members').insert({ family_id: family.familyId, user_id: userId, role: 'child', child_id: family.minh.childId, display_name: 'Minh' }).select('id').single();
    expect(member.error).toBeNull();
    const account = await db.from('child_accounts').insert({ family_id: family.familyId, child_id: family.minh.childId as string, member_id: member.data?.id as string, login_id: loginId, auth_email: guessable });
    expect(account.error).toBeNull();
    // la faille : la connexion directe avec l'adresse devinable ET le mot de passe de l'enfant fonctionnait (hors verrou)
    expect(await directSignIn(guessable, 'abc123')).toBeNull();

    // migration (exécutée une fois au déploiement ; ici rejouée sur ce compte)
    const migrated = await db.rpc('migrate_legacy_child_accounts');
    expect(migrated.error).toBeNull();
    expect(migrated.data).toBeGreaterThanOrEqual(1);

    // après : la connexion directe échoue, avec l'ancienne adresse comme avec la nouvelle (adresse UUID, mot de passe GoTrue inconnu)
    expect(await directSignIn(guessable, 'abc123')).not.toBeNull();
    const internal = await internalEmailOf(family, loginId);
    expect(internal).toMatch(UUID_EMAIL);
    expect(internal).not.toBe(guessable);
    expect(await directSignIn(internal, 'abc123')).not.toBeNull();

    // child-login : MÊME e-mail parent, MÊME identifiant, MÊME mot de passe ; le même compte (même utilisateur, mêmes données)
    const ok = await childLoginRequest(family.parent.email, loginId, 'abc123');
    expect(ok.status).toBe(200);
    expect(ok.body.session?.access_token).toBeTruthy();
    const { createClient } = await import('@supabase/supabase-js');
    const client = createClient(supabaseUrl(), process.env.E2E_ANON_KEY as string, { auth: { persistSession: false } });
    await client.auth.setSession({ access_token: ok.body.session?.access_token as string, refresh_token: ok.body.session?.refresh_token as string });
    const { data: me } = await client.auth.getUser();
    expect(me.user?.id).toBe(userId);
    expect(me.user?.app_metadata?.account_type).toBe('child');
    // le verrou anti-essais protège toujours : mauvais mot de passe → échec unique
    expect(await childLoginRequest(family.parent.email, loginId, 'faux-mdp')).toEqual({ status: 401, body: { error: 'invalid_credentials' } });
    // et l'interface fonctionne de bout en bout
    const page = await childSignIn(browser, family.parent.email, loginId, 'abc123');
    await expect(page.getByText('Chào Minh!')).toBeVisible({ timeout: 20_000 });
  });

  test('un compte créé par create-child : adresse UUID, jamais de connexion directe, mot de passe changé via la base', async () => {
    test.setTimeout(120_000);
    const family = await createFamily();
    await revokeChildMembers(family);
    const token = await accessTokenOf(family.parent);
    const headers = { 'Content-Type': 'application/json', apikey: process.env.E2E_ANON_KEY as string, Authorization: `Bearer ${token}` };
    const loginId = `neuf.${Math.random().toString(36).slice(2, 7)}`;
    const create = await fetch(`${supabaseUrl()}/functions/v1/create-child`, { method: 'POST', headers, body: JSON.stringify({ childId: family.minh.childId, loginId, password: 'abc123' }) });
    expect(create.status).toBe(200);
    const internal = await internalEmailOf(family, loginId);
    expect(internal).toMatch(UUID_EMAIL);
    expect(internal).not.toContain(loginId);
    // aucune connexion directe, ni avec le vrai mot de passe, ni avec l'adresse « logique » devinable
    expect(await directSignIn(internal, 'abc123')).not.toBeNull();
    expect(await directSignIn(`${loginId}@child.taskmate.invalid`, 'abc123')).not.toBeNull();
    expect((await childLoginRequest(family.parent.email, loginId, 'abc123')).status).toBe(200);
    // le parent change le mot de passe : l'ancien ne marche plus dans child-login, le nouveau oui ; GoTrue reste fermé
    const reset = await fetch(`${supabaseUrl()}/functions/v1/reset-child-password`, { method: 'POST', headers, body: JSON.stringify({ childId: family.minh.childId, password: 'nouveau1' }) });
    expect(reset.status).toBe(200);
    expect((await childLoginRequest(family.parent.email, loginId, 'abc123')).status).toBe(401);
    expect((await childLoginRequest(family.parent.email, loginId, 'nouveau1')).status).toBe(200);
    expect(await directSignIn(internal, 'nouveau1')).not.toBeNull();
    // suppression du compte : child-login ne délivre plus rien
    const del = await fetch(`${supabaseUrl()}/functions/v1/delete-child`, { method: 'POST', headers, body: JSON.stringify({ childId: family.minh.childId }) });
    expect(del.status).toBe(200);
    expect((await childLoginRequest(family.parent.email, loginId, 'nouveau1')).status).toBe(401);
  });
});

test.describe('ajouter un enfant après l\'onboarding', () => {
  test('le parent ajoute un enfant depuis Hồ sơ, l\'enfant se connecte, la tâche va à l\'enfant choisi', async ({ browser }) => {
    test.setTimeout(180_000);
    const tag = Math.random().toString(36).slice(2, 7);
    const loginId = `cam.${tag}`;
    const family = await createFamily();
    // l'identifiant n'est unique que DANS la famille : « dup » est déjà pris par Minh (compte créé par la fonction create-child)
    await revokeChildMembers(family);
    const created = await fetch(`${supabaseUrl()}/functions/v1/create-child`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: process.env.E2E_ANON_KEY as string, Authorization: `Bearer ${await accessTokenOf(family.parent)}` },
      body: JSON.stringify({ childId: family.minh.childId, loginId: `dup.${tag}`, password: 'abc123' }),
    });
    expect(created.status).toBe(200);
    const parentCtx = await browser.newContext();
    await signInContext(parentCtx, family.parent);
    const parent = await parentCtx.newPage();
    trace(parent, 'parent');
    await open(parent, '/more');

    // cartes des enfants existants (sélectionnables) + carte « Thêm con »
    await expect(parent.getByRole('radio', { name: /^Minh,/ })).toBeVisible();
    await expect(parent.getByRole('radio', { name: /^Khang,/ })).toBeVisible();
    await parent.getByRole('button', { name: 'Thêm con' }).click();

    // identifiant déjà pris dans la famille : l'erreur s'affiche et aucun profil fantôme n'est conservé
    await parent.getByLabel('Tên của con').fill('Cam');
    await parent.getByLabel('Ngày sinh (YYYY-MM-DD)').fill('2016-02-01');
    await parent.getByLabel('Tên đăng nhập (chữ, số, . _ -)').fill(`dup.${tag}`);
    await parent.getByLabel('Mật khẩu (tối thiểu 6 ký tự)').fill('secret1');
    await parent.getByRole('button', { name: 'Tạo hồ sơ và tài khoản cho con' }).click();
    await expect(parent.getByText('Tên đăng nhập này đã có người dùng. Hãy chọn tên khác.')).toBeVisible({ timeout: 20_000 });

    // identifiant libre : l'enfant est créé et l'accès est affiché une seule fois
    await parent.getByLabel('Tên đăng nhập (chữ, số, . _ -)').fill(loginId);
    await parent.getByRole('button', { name: 'Tạo hồ sơ và tài khoản cho con' }).click();
    await expect(parent.getByText(`Tên đăng nhập: ${loginId}`)).toBeVisible({ timeout: 20_000 });
    await expect(parent.getByText('Mật khẩu: secret1')).toBeVisible();
    await expect(parent.getByText(/sẽ không hiển thị lại/)).toBeVisible();
    await expect(parent.getByRole('button', { name: 'Sao chép tên đăng nhập và mật khẩu Cam' })).toBeVisible();
    await parent.getByRole('button', { name: 'Hoàn tất' }).click();
    await expect(parent.getByRole('radio', { name: /^Cam,/ })).toBeVisible();
    await expect(parent.getByText('Mật khẩu: secret1')).toHaveCount(0);

    // l'enfant se connecte sur son téléphone
    const child = await childSignIn(browser, family.parent.email, loginId, 'secret1');
    await expect(child.getByText('Chào Cam!')).toBeVisible({ timeout: 20_000 });

    // le parent crée une tâche pour Cam (« Cho ai? » : Cam seule cochée)
    const taskTitle = title('Tưới cây');
    await parent.getByRole('radio', { name: /^Cam,/ }).click();
    await parent.getByRole('tab', { name: /Hôm nay/ }).click(); // navigation interne : l'enfant affiché (Cam) est conservé
    await parent.getByRole('button', { name: 'Thêm việc' }).click();
    await parent.getByLabel('Tên công việc').fill(taskTitle);
    await parent.getByRole('button', { name: 'Thêm tùy chọn' }).click();
    await expect(parent.getByText('Cho ai?')).toBeVisible();
    await expect(parent.getByRole('checkbox', { name: 'Cam' })).toBeChecked();
    await expect(parent.getByRole('checkbox', { name: 'Minh' })).not.toBeChecked();
    await parent.getByRole('button', { name: 'Lưu' }).click();
    await expect.poll(() => taskChildId(family, taskTitle), { timeout: 20_000 }).not.toBeNull();
    await expect(child.getByRole('checkbox', { name: taskTitle })).toBeVisible({ timeout: 20_000 });
  });

  test('Gérer les profils : le parent change le mot de passe puis supprime le compte', async ({ browser }) => {
    test.setTimeout(120_000);
    const family = await createFamily();
    await revokeChildMembers(family);
    const parentCtx = await browser.newContext();
    await signInContext(parentCtx, family.parent);
    const parent = await parentCtx.newPage();
    await open(parent, '/more/children');
    const tag = Math.random().toString(36).slice(2, 7);
    await expect(parent.getByRole('button', { name: 'Thêm con' })).toBeVisible();
    await parent.getByLabel('Tên đăng nhập (chữ, số, . _ -)').first().fill(`gest.${tag}`);
    await parent.getByLabel('Mật khẩu (tối thiểu 6 ký tự)').first().fill('abc123');
    await parent.getByRole('button', { name: 'Tạo tài khoản Minh' }).click();
    await expect(parent.getByText(`Tên đăng nhập: gest.${tag}`)).toBeVisible({ timeout: 20_000 });
    await parent.getByLabel('Mật khẩu mới').fill('nouveau1');
    await parent.getByRole('button', { name: 'Đổi mật khẩu Minh' }).click();
    await expect(parent.getByText('Đã đổi mật khẩu')).toBeVisible({ timeout: 20_000 });
    parent.once('dialog', (d) => void d.accept());
    await parent.getByRole('button', { name: 'Xóa tài khoản Minh' }).click();
    await expect(parent.getByRole('button', { name: 'Tạo tài khoản Minh' })).toBeVisible({ timeout: 20_000 });
  });

  test('un enfant ne voit ni « Thêm con » ni les écrans d\'ajout et de gestion', async ({ browser }) => {
    const family = await createFamily();
    const ctx = await browser.newContext();
    await signInContext(ctx, family.minh);
    const page = await ctx.newPage();
    await open(page, '/more');
    await expect(page.getByLabel(/^Minh,/).first()).toBeVisible();
    await expect(page.getByRole('radio', { name: /^Minh,/ })).toHaveCount(0); // carte simple, pas de sélection (D-052)
    await expect(page.getByRole('button', { name: 'Thêm con' })).toHaveCount(0);
    await open(page, '/more/add-child');
    await expect(page.getByLabel('Tên của con')).toHaveCount(0);
    await open(page, '/more/children');
    await expect(page.getByRole('button', { name: 'Thêm con' })).toHaveCount(0);
    await expect(page.getByLabel('Mật khẩu mới')).toHaveCount(0);
  });
});

test.describe('mise en page bureau', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('la file « Cần duyệt » affiche Tâches et Récompenses côte à côte', async ({ browser }) => {
    const family = await createFamily();
    const taskTitle = title('Rửa bát');
    const taskId = await seedTask(family, 'minh', taskTitle);
    const { createClient } = await import('@supabase/supabase-js');
    const childClient = createClient(supabaseUrl(), process.env.E2E_ANON_KEY as string, { auth: { persistSession: false } });
    await childClient.auth.signInWithPassword({ email: family.minh.email, password: family.minh.password });
    const { error } = await childClient.rpc('complete_task', { p_task_id: taskId, p_tx_id: crypto.randomUUID() });
    expect(error).toBeNull();

    const ctx = await browser.newContext();
    await signInContext(ctx, family.parent);
    const page = await ctx.newPage();
    await open(page, '/approvals');
    await expect(page.getByRole('heading', { name: 'Việc (1)' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Phần thưởng (0)' })).toBeVisible();
    await expect(page.getByRole('button', { name: `Duyệt ${taskTitle}` })).toBeVisible();
  });
});

test.describe('accessibilité clavier', () => {
  test('Tab atteint les boutons avec un focus visible, Entrée les active', async ({ browser }) => {
    const family = await createFamily();
    const ctx = await browser.newContext();
    await signInContext(ctx, family.parent);
    const page = await ctx.newPage();
    await open(page);
    await expect(page.getByText('Chào Minh!')).toBeVisible();

    let reachedBell = false;
    for (let i = 0; i < 25 && !reachedBell; i += 1) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        return { label: el.getAttribute('aria-label') ?? '', visible: el.matches(':focus-visible') && getComputedStyle(el).outlineStyle !== 'none' };
      });
      if (info) expect(info.visible).toBe(true);
      reachedBell = !!info?.label.startsWith('Thông báo');
    }
    expect(reachedBell).toBe(true);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/notifications/);
  });
});

test.describe('diagnostic de production', () => {
  test('Réglages → Diagnostic vérifie le serveur et signale une adresse Supabase locale', async ({ browser }) => {
    const family = await createFamily();
    const ctx = await browser.newContext();
    await signInContext(ctx, family.parent);
    const page = await ctx.newPage();
    await open(page, '/more/settings');
    await page.getByRole('button', { name: 'Chẩn đoán' }).click(); // libellé du bouton dans la langue de l'app (vi)
    await expect(page.getByRole('heading', { name: 'Diagnostic' })).toBeVisible();
    for (const label of ['Connexion à Supabase', 'Tables', 'Fonctions SQL \\(RPC\\)', 'Sécurité des lignes \\(RLS\\)', 'Realtime : tables publiées', 'Realtime : connexion', 'Edge Function child-login', 'Edge Function create-child', 'Edge Function reset-child-password', 'Edge Function delete-child', 'Edge Function delete-account', 'Edge Function send-push']) {
      await expect(page.getByLabel(new RegExp(`^${label} : OK`))).toBeVisible({ timeout: 20_000 });
    }
    // le front de test est construit contre 127.0.0.1 : le diagnostic doit le dire
    await expect(page.getByLabel(/^Adresse Supabase de l'application : À corriger/)).toBeVisible();
  });
});

test.describe('verrouillage de la connexion enfant', () => {
  test('réponse d\'échec identique, verrouillage temporaire par IP (429), journal remis à zéro', async () => {
    test.setTimeout(120_000);
    await resetAttempts();
    try {
      const family = await createFamily();
      await revokeChildMembers(family);
      const token = await accessTokenOf(family.parent);
      const headers = { 'Content-Type': 'application/json', apikey: process.env.E2E_ANON_KEY as string };
      const created = await fetch(`${supabaseUrl()}/functions/v1/create-child`, {
        method: 'POST',
        headers: { ...headers, Authorization: `Bearer ${token}` },
        body: JSON.stringify({ childId: family.minh.childId, loginId: 'verrou.test', password: 'abc123' }),
      });
      expect(created.status).toBe(200);
      const login = async (parentEmail: string, loginId: string, password: string, ip: string) => {
        const res = await fetch(`${supabaseUrl()}/functions/v1/child-login`, {
          method: 'POST',
          headers: { ...headers, 'x-forwarded-for': ip },
          body: JSON.stringify({ parentEmail, loginId, password }),
        });
        return { status: res.status, body: (await res.json()) as Record<string, unknown> };
      };
      const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
      // la bonne combinaison fonctionne
      const ok = await login(family.parent.email, 'verrou.test', 'abc123', ip);
      expect(ok.status).toBe(200);
      expect(ok.body).toHaveProperty('session.access_token');
      // aucune énumération : e-mail inconnu, identifiant inconnu, mot de passe faux, champs manquants → exactement la même réponse
      const failures = [
        await login('inconnu@e2e.test', 'verrou.test', 'abc123', ip),
        await login(family.parent.email, 'fantome', 'abc123', ip),
        await login(family.parent.email, 'verrou.test', 'mauvais', ip),
        await login('', '', '', ip),
      ];
      for (const f of failures) expect(f).toEqual({ status: 401, body: { error: 'invalid_credentials' } });
      // verrouillage : 10 échecs depuis la même IP (4 déjà comptés) puis même les BONS identifiants sont refusés
      for (let i = 0; i < 6; i += 1) await login(family.parent.email, 'verrou.test', `faux-${i}`, ip);
      const locked = await login(family.parent.email, 'verrou.test', 'abc123', ip);
      expect(locked).toEqual({ status: 429, body: { error: 'too_many_attempts' } });
    } finally {
      await resetAttempts();
    }
  });
});
