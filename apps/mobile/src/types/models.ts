/**
 * Alias métier dérivés des types GÉNÉRÉS (`db.ts`, régénéré par la CI : `supabase gen types typescript --local`).
 * Ne rien écrire à la main dans `db.ts` : la CI échoue s'il diffère de la base.
 */
import type { Database, Enums, Tables } from './db';

export type { Json } from './db';

export type MemberRole = Enums<'member_role'>;
export type TaskCategory = Enums<'task_category'>;
export type TimeKind = Enums<'time_kind'>;
export type PointReason = Enums<'point_reason'>;
export type RequestStatus = Enums<'request_status'>;
export type RecurrenceRule = Enums<'recurrence_rule'>;
export type QuizStatus = Enums<'quiz_status'>;
export type QuizAttemptStatus = Enums<'quiz_attempt_status'>;
export type QuizMaterialKind = Enums<'quiz_material_kind'>;

export type FamilyRow = Tables<'families'>;
export type ChildRow = Tables<'children'>;
export type MemberRow = Tables<'members'>;
export type ChildAccountRow = Tables<'child_accounts'>;
export type DeviceRow = Tables<'devices'>;
export type TaskRow = Tables<'tasks'>;
export type RecurrenceRow = Tables<'recurrences'>;
export type GoalRow = Tables<'goals'>;
export type RewardRow = Tables<'rewards'>;
export type PointTransactionRow = Tables<'point_transactions'>;
export type RewardRequestRow = Tables<'reward_requests'>;
export type ActivityLogRow = Tables<'activity_log'>;
export type NotificationPrefsRow = Tables<'notification_prefs'>;
export type QuizSetRow = Tables<'quiz_sets'>;
export type QuizQuestionRow = Tables<'quiz_questions'>;
export type QuizAnswerKeyRow = Tables<'quiz_answer_keys'>;
export type QuizAttemptRow = Tables<'quiz_attempts'>;
export type QuizResultRow = Tables<'quiz_results'>;
export type QuizAnswerRow = Tables<'quiz_answers'>;

export type { Database };
