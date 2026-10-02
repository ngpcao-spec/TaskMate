import { createClient, type Session } from '@supabase/supabase-js';
import type { BrowserContext } from '@playwright/test';

const required = (name: string, value: string | undefined): string => {
  if (!value) throw new Error(`Variable d'environnement manquante : ${name} (voir e2e-web/README.md)`);
  return value;
};

export const supabaseUrl = () => required('E2E_SUPABASE_URL', process.env.E2E_SUPABASE_URL);
const anonKey = () => required('E2E_ANON_KEY', process.env.E2E_ANON_KEY);
const admin = () => createClient(supabaseUrl(), required('E2E_SERVICE_ROLE_KEY', process.env.E2E_SERVICE_ROLE_KEY), { auth: { persistSession: false } });

/** Clé de stockage de la session supabase-js (identique à celle de l'app). */
export const sessionStorageKey = () => `sb-${new URL(supabaseUrl()).hostname.split('.')[0]}-auth-token`;

/** Jour local de la famille (Asia/Ho_Chi_Minh), jamais dérivé de l'UTC. */
export const todayVn = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

export type Person = { email: string; password: string; userId: string; memberId: string; childId: string | null };
export type FamilyFixture = { familyId: string; parent: Person; minh: Person; khang: Person };

const uid = () => Math.random().toString(36).slice(2, 10);
const birth = (years: number) => new Date(Date.now() - years * 365.25 * 86_400_000).toISOString().slice(0, 10);

/** Crée une famille isolée (parent + Minh + Khang) avec les droits du service local, sans passer par l'UI d'onboarding. */
export async function createFamily(): Promise<FamilyFixture> {
  const db = admin();
  const tag = uid();
  const password = `Pw-${tag}-1!`;
  const user = async (email: string) => {
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message}`);
    return data.user.id;
  };
  const [parentUser, minhUser, khangUser] = await Promise.all([user(`ba-${tag}@e2e.test`), user(`minh-${tag}@e2e.test`), user(`khang-${tag}@e2e.test`)]);

  const { data: family, error: fe } = await db.from('families').insert({ name: `Gia đình ${tag}` }).select('id').single();
  if (fe || !family) throw new Error(`families: ${fe?.message}`);
  const familyId = family.id;

  const { data: kids, error: ce } = await db
    .from('children')
    .insert([
      { family_id: familyId, name: 'Minh', birth_date: birth(17), color: '#1E88F5', sort_order: 1 },
      { family_id: familyId, name: 'Khang', birth_date: birth(13), color: '#2EC4A6', sort_order: 2 },
    ])
    .select('id, name');
  if (ce || !kids) throw new Error(`children: ${ce?.message}`);
  const childId = (name: string) => kids.find((k) => k.name === name)?.id as string;

  const { data: members, error: me } = await db
    .from('members')
    .insert([
      { family_id: familyId, user_id: parentUser, role: 'parent', display_name: 'Ba' },
      { family_id: familyId, user_id: minhUser, role: 'child', child_id: childId('Minh'), display_name: 'Minh' },
      { family_id: familyId, user_id: khangUser, role: 'child', child_id: childId('Khang'), display_name: 'Khang' },
    ])
    .select('id, user_id');
  if (me || !members) throw new Error(`members: ${me?.message}`);
  const memberId = (userId: string) => members.find((m) => m.user_id === userId)?.id as string;

  await db.from('rewards').insert([{ family_id: familyId, title: 'Chơi game 1 tiếng', icon: 'gamepad-2', cost: 100, sort_order: 1 }]);

  return {
    familyId,
    parent: { email: `ba-${tag}@e2e.test`, password, userId: parentUser, memberId: memberId(parentUser), childId: null },
    minh: { email: `minh-${tag}@e2e.test`, password, userId: minhUser, memberId: memberId(minhUser), childId: childId('Minh') },
    khang: { email: `khang-${tag}@e2e.test`, password, userId: khangUser, memberId: memberId(khangUser), childId: childId('Khang') },
  };
}

/** Tâche du jour créée par le parent (via le service local). */
export async function seedTask(family: FamilyFixture, child: 'minh' | 'khang', title: string, points = 10): Promise<string> {
  const { data, error } = await admin()
    .from('tasks')
    .insert({ family_id: family.familyId, child_id: family[child].childId as string, title, date: todayVn(), time_kind: 'anytime', points, created_by: family.parent.memberId })
    .select('id')
    .single();
  if (error || !data) throw new Error(`tasks: ${error?.message}`);
  return data.id;
}

/** Code d'invitation enfant valide 24 h. */
export async function seedInvite(family: FamilyFixture, child: 'minh' | 'khang', code: string): Promise<void> {
  const { error } = await admin()
    .from('invite_codes')
    .insert({ family_id: family.familyId, child_id: family[child].childId as string, role: 'child', code, expires_at: new Date(Date.now() + 86_400_000).toISOString(), created_by: family.parent.memberId });
  if (error) throw new Error(`invite_codes: ${error.message}`);
}

/** Lecture directe (service local) pour vérifier l'état serveur indépendamment de l'UI. */
export async function serverState(family: FamilyFixture, child: 'minh' | 'khang', title: string) {
  const db = admin();
  const { data: task } = await db.from('tasks').select('completed_at, validated_at').eq('family_id', family.familyId).eq('title', title).single();
  const { data: balance } = await db.from('child_balances').select('balance').eq('child_id', family[child].childId as string).maybeSingle();
  const { count } = await db.from('point_transactions').select('id', { count: 'exact', head: true }).eq('child_id', family[child].childId as string);
  return { completed: !!task?.completed_at, validated: !!task?.validated_at, balance: balance?.balance ?? 0, transactions: count ?? 0 };
}

async function sessionOf(person: Person): Promise<Session> {
  const { data, error } = await createClient(supabaseUrl(), anonKey(), { auth: { persistSession: false } }).auth.signInWithPassword({ email: person.email, password: person.password });
  if (error || !data.session) throw new Error(`signIn ${person.email}: ${error?.message}`);
  return data.session;
}

/** Ouvre la session de `person` dans ce contexte de navigateur (localStorage, comme l'app). */
export async function signInContext(context: BrowserContext, person: Person): Promise<void> {
  const session = await sessionOf(person);
  await context.addInitScript(([key, value]) => window.localStorage.setItem(key as string, value as string), [sessionStorageKey(), JSON.stringify(session)]);
}
