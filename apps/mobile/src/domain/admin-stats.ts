// Suivi des utilisateurs (D-102) : lecture seule, réservé à l'administrateur de la plateforme. Ce module valide et met en forme les réponses des RPC
// `admin_*` (agrégats calculés en SQL). Aucun contenu (tâches, récompenses, réponses), aucun prénom ni identifiant d'enfant ne transite par ici :
// pour les enfants, seulement un nombre, un pays et une classe.

export type ActiveSplit = { parents: number; children: number };
export type Overview = {
  families: number;
  parents: number;
  children: number;
  newFamilies7d: number;
  newFamilies30d: number;
  active: { today: ActiveSplit; d7: ActiveSplit; d30: ActiveSplit };
  familiesWithNotifications: number;
};
export type WeekPoint = { weekStart: string; families: number };
export type DayPoint = { day: string; parents: number; children: number };
export type Series = { weeks: WeekPoint[]; days: DayPoint[] };
export type UsageCounters = {
  tasksCreated: number;
  tasksGenerated: number;
  tasksCompleted: number;
  tasksValidated: number;
  quizzesSubmitted: number;
  quizzesValidated: number;
  rewardRequests: number;
  aiCalls: number;
  aiFailed: number;
  avatarCalls: number;
  avatarFailed: number;
};
export type QuizClassRow = { country: string; grade: string; subject: string; submitted7d: number; validated7d: number; submitted30d: number; validated30d: number };
export type AiModelRow = { kind: 'questions' | 'avatar'; model: string; calls7d: number; calls30d: number; failed30d: number; inputTokens30d: number; outputTokens30d: number };
export type Usage = { d7: UsageCounters; d30: UsageCounters; quizByClass: QuizClassRow[]; aiByModel: AiModelRow[] };
export type FamilyStatus = 'active' | 'inactive' | 'dormant';
export type ClassInfo = { country: string | null; grade: string | null };
export type FamilyRow = {
  familyId: string;
  name: string;
  creatorEmail: string | null;
  countries: string[];
  parents: number;
  children: number;
  classes: ClassInfo[];
  createdAt: string;
  lastActiveAt: string | null;
  status: FamilyStatus;
  notifications: boolean;
};
export type FamilyPage = { total: number; page: number; pageSize: number; rows: FamilyRow[] };
export type FamilyDetail = FamilyRow & { activeDevices: number; usage30d: UsageCounters };
export type CronJob = { jobname: string; schedule: string; active: boolean; lastRunAt: string | null; lastStatus: string | null };
export type Health = { dbSizeBytes: number; activeDevices: number; cron: CronJob[] | null };

// ───────────── validation stricte des réponses (JSON non fiable) ─────────────
const invalid = (): never => {
  throw new Error('invalid_stats');
};
const record = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : invalid());
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : invalid());
const int = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : invalid());
const text = (v: unknown): string => (typeof v === 'string' ? v : invalid());
const textOrNull = (v: unknown): string | null => (v === null || v === undefined ? null : text(v));

const split = (v: unknown): ActiveSplit => {
  const r = record(v);
  return { parents: int(r.parents), children: int(r.children) };
};

export function parseOverview(raw: unknown): Overview {
  const r = record(raw);
  const a = record(r.active);
  return {
    families: int(r.families),
    parents: int(r.parents),
    children: int(r.children),
    newFamilies7d: int(r.new_families_7d),
    newFamilies30d: int(r.new_families_30d),
    active: { today: split(a.today), d7: split(a.d7), d30: split(a.d30) },
    familiesWithNotifications: int(r.families_with_notifications),
  };
}

export function parseSeries(raw: unknown): Series {
  const r = record(raw);
  return {
    weeks: list(r.weeks).map((w) => {
      const x = record(w);
      return { weekStart: text(x.week_start), families: int(x.families) };
    }),
    days: list(r.days).map((d) => {
      const x = record(d);
      return { day: text(x.day), parents: int(x.parents), children: int(x.children) };
    }),
  };
}

export function parseUsageCounters(raw: unknown): UsageCounters {
  const r = record(raw);
  return {
    tasksCreated: int(r.tasks_created),
    tasksGenerated: int(r.tasks_generated),
    tasksCompleted: int(r.tasks_completed),
    tasksValidated: int(r.tasks_validated),
    quizzesSubmitted: int(r.quizzes_submitted),
    quizzesValidated: int(r.quizzes_validated),
    rewardRequests: int(r.reward_requests),
    aiCalls: int(r.ai_calls),
    aiFailed: int(r.ai_failed),
    avatarCalls: int(r.avatar_calls),
    avatarFailed: int(r.avatar_failed),
  };
}

export function parseUsage(raw: unknown): Usage {
  const r = record(raw);
  return {
    d7: parseUsageCounters(r.d7),
    d30: parseUsageCounters(r.d30),
    quizByClass: list(r.quiz_by_class).map((q) => {
      const x = record(q);
      return { country: text(x.country), grade: text(x.grade), subject: text(x.subject), submitted7d: int(x.submitted_7d), validated7d: int(x.validated_7d), submitted30d: int(x.submitted_30d), validated30d: int(x.validated_30d) };
    }),
    aiByModel: list(r.ai_by_model).map((m) => {
      const x = record(m);
      const kind = x.kind === 'avatar' ? 'avatar' : x.kind === 'questions' ? 'questions' : invalid();
      return { kind, model: text(x.model), calls7d: int(x.calls_7d), calls30d: int(x.calls_30d), failed30d: int(x.failed_30d), inputTokens30d: int(x.input_tokens_30d), outputTokens30d: int(x.output_tokens_30d) };
    }),
  };
}

const status = (v: unknown): FamilyStatus => (v === 'active' || v === 'inactive' || v === 'dormant' ? v : invalid());

export function parseFamilyRow(raw: unknown): FamilyRow {
  const r = record(raw);
  return {
    familyId: text(r.family_id),
    name: text(r.name),
    creatorEmail: textOrNull(r.creator_email),
    countries: list(r.countries ?? []).map(text),
    parents: int(r.parents),
    children: int(r.children),
    classes: list(r.classes ?? []).map((c) => {
      const x = record(c);
      return { country: textOrNull(x.country), grade: textOrNull(x.grade) };
    }),
    createdAt: text(r.created_at),
    lastActiveAt: textOrNull(r.last_active_at),
    status: status(r.status),
    notifications: r.notifications === true,
  };
}

export function parseFamilyPage(raw: unknown): FamilyPage {
  const r = record(raw);
  return { total: int(r.total), page: int(r.page), pageSize: int(r.page_size), rows: list(r.rows).map(parseFamilyRow) };
}

export function parseFamilyDetail(raw: unknown): FamilyDetail {
  const r = record(raw);
  return { ...parseFamilyRow(r), activeDevices: int(r.active_devices), usage30d: parseUsageCounters(r.usage_30d) };
}

export function parseHealth(raw: unknown): Health {
  const r = record(raw);
  return {
    dbSizeBytes: int(r.db_size_bytes),
    activeDevices: int(r.active_devices),
    cron:
      r.cron === null || r.cron === undefined
        ? null
        : list(r.cron).map((j) => {
            const x = record(j);
            return { jobname: text(x.jobname), schedule: text(x.schedule), active: x.active === true, lastRunAt: textOrNull(x.last_run_at), lastStatus: textOrNull(x.last_status) };
          }),
  };
}

// ───────────── mise en forme ─────────────
/** Taille lisible (Ko / Mo / Go) ; la base ne renvoie que des octets. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  const units = ['Ko', 'Mo', 'Go', 'To'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value >= 100 ? Math.round(value) : Math.round(value * 10) / 10} ${units[i]}`;
}

/** « VN 7 », « FR CM1 » ; une classe ou un pays non renseigné s'affiche « — ». */
export const classLabel = (c: ClassInfo): string => `${c.country ?? '—'} ${c.grade ?? '—'}`;

/** Pays distincts d'une famille, ou « — » quand aucun enfant n'a de pays. */
export const countriesLabel = (countries: readonly string[]): string => (countries.length === 0 ? '—' : countries.join(' · '));

/** Dernière activité : jour (`YYYY-MM-DD`) du fuseau de la plateforme, ou `null` si jamais active. */
export function dayOf(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms + 7 * 3_600_000); // UTC+7 : jour de la plateforme (Asia/Ho_Chi_Minh, sans heure d'été)
  return d.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` → `dd/MM`. */
export const shortDay = (day: string): string => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

/** Colonnes triables de la liste des familles (liste fermée, la même que la base). */
export const FAMILY_SORTS = ['name', 'creator_email', 'parents', 'children', 'created_at', 'last_active_at', 'notifications'] as const;
export type FamilySort = (typeof FAMILY_SORTS)[number];
export type SortState = { sort: FamilySort; dir: 'asc' | 'desc' };
export const DEFAULT_SORT: SortState = { sort: 'last_active_at', dir: 'desc' };

/** Toucher la colonne déjà triée inverse le sens ; une nouvelle colonne démarre en ordre naturel (texte croissant, nombres et dates décroissants). */
export function nextSort(current: SortState, column: FamilySort): SortState {
  if (current.sort === column) return { sort: column, dir: current.dir === 'asc' ? 'desc' : 'asc' };
  return { sort: column, dir: column === 'name' || column === 'creator_email' ? 'asc' : 'desc' };
}

export const lastPage = (total: number, pageSize: number): number => Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

/** État de la dernière exécution d'une tâche planifiée. */
export type CronState = 'ok' | 'failed' | 'never' | 'paused';
export function cronState(job: CronJob): CronState {
  if (!job.active) return 'paused';
  if (job.lastRunAt === null) return 'never';
  return job.lastStatus === 'succeeded' ? 'ok' : 'failed';
}

/** Barres du graphique : une valeur (ou deux segments empilés) par période. */
export type ChartBar = { key: string; label: string; segments: { value: number; tone: 0 | 1 }[]; accessibilityLabel: string };

/** Nouvelles familles par semaine : une barre par semaine, étiquette = jour du lundi. */
export function weekBars(weeks: readonly WeekPoint[], describe: (weekStart: string, families: number) => string): ChartBar[] {
  return weeks.map((w) => ({ key: w.weekStart, label: shortDay(w.weekStart), segments: [{ value: w.families, tone: 0 }], accessibilityLabel: describe(w.weekStart, w.families) }));
}

/** Membres actifs par jour : parents (teinte 0) et enfants (teinte 1) empilés ; l'étiquette n'est posée qu'un jour sur cinq (lisible sur un téléphone). */
export function dayBars(days: readonly DayPoint[], describe: (day: string, parents: number, children: number) => string): ChartBar[] {
  return days.map((d, i) => ({
    key: d.day,
    label: (days.length - 1 - i) % 5 === 0 ? shortDay(d.day) : '',
    segments: [
      { value: d.parents, tone: 0 },
      { value: d.children, tone: 1 },
    ],
    accessibilityLabel: describe(d.day, d.parents, d.children),
  }));
}

/** `dd/MM/yyyy HH:mm` en heure de la plateforme (UTC+7) ; `null` → « — ». */
export function formatStamp(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '—';
  const d = new Date(ms + 7 * 3_600_000).toISOString();
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)} ${d.slice(11, 16)}`;
}

/** `dd/MM/yyyy` en jour de la plateforme ; `null` → « — ». */
export const formatDate = (iso: string | null): string => (formatStamp(iso) === '—' ? '—' : formatStamp(iso).slice(0, 10));
