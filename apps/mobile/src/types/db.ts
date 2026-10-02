/**
 * Types de la base, écrits à la main d'après supabase/migrations (D-009).
 * À régénérer : `supabase gen types typescript --local > src/types/db.ts`.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type MemberRole = 'parent' | 'child';
export type TaskCategory = 'study' | 'sport' | 'chores' | 'personal' | 'other';
export type TimeKind = 'range' | 'deadline' | 'anytime';
export type PointReason = 'task_completed' | 'task_uncompleted' | 'reward_redeemed' | 'manual_adjust';
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';
export type RecurrenceRule = 'daily' | 'weekdays';

type Timestamps = { created_at: string; updated_at: string; deleted_at: string | null };

export type FamilyRow = Timestamps & { id: string; name: string; timezone: string };
export type ChildRow = Timestamps & {
  id: string;
  family_id: string;
  name: string;
  birth_date: string;
  avatar: string | null;
  color: string | null;
  label: string | null;
  sort_order: number;
};
export type MemberRow = Timestamps & {
  id: string;
  family_id: string;
  user_id: string;
  role: MemberRole;
  child_id: string | null;
  display_name: string;
  revoked_at: string | null;
};
export type InviteCodeRow = {
  id: string;
  family_id: string;
  child_id: string | null;
  role: MemberRole;
  code: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};
export type DeviceRow = {
  id: string;
  member_id: string;
  expo_push_token: string | null;
  platform: 'ios' | 'android' | null;
  last_seen_at: string;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};
export type TaskRow = Timestamps & {
  id: string;
  family_id: string;
  child_id: string;
  title: string;
  category: TaskCategory;
  note: string | null;
  /** Jour local de la famille, `YYYY-MM-DD`. */
  date: string;
  time_kind: TimeKind;
  start_time: string | null;
  end_time: string | null;
  points: number;
  completed_at: string | null;
  completed_by: string | null;
  recurrence_id: string | null;
  created_by: string;
};
export type RecurrenceRow = Timestamps & {
  id: string;
  family_id: string;
  child_id: string;
  title: string;
  category: TaskCategory;
  note: string | null;
  time_kind: TimeKind;
  start_time: string | null;
  end_time: string | null;
  points: number;
  rule: RecurrenceRule;
  weekdays: number[] | null;
  starts_on: string;
  ends_on: string | null;
  created_by: string;
};
export type GoalRow = Timestamps & {
  id: string;
  family_id: string;
  child_id: string;
  title: string;
  icon: string;
  target: number;
  progress: number;
  unit: string | null;
  achieved_at: string | null;
  created_by: string;
};
export type RewardRow = Timestamps & {
  id: string;
  family_id: string;
  title: string;
  icon: string;
  cost: number;
  child_id: string | null;
  sort_order: number;
};
export type PointTransactionRow = {
  id: string;
  family_id: string;
  child_id: string;
  delta: number;
  reason: PointReason;
  ref_id: string | null;
  note: string | null;
  created_by: string;
  created_at: string;
};
export type RewardRequestRow = {
  id: string;
  family_id: string;
  child_id: string;
  reward_id: string;
  reward_title: string;
  cost: number;
  status: RequestStatus;
  requested_by: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
};
export type ActivityLogRow = {
  id: string;
  family_id: string;
  child_id: string | null;
  actor_member_id: string | null;
  type: string;
  payload: Json;
  created_at: string;
};
export type ChildBalanceRow = {
  child_id: string;
  family_id: string;
  balance: number;
  reserved: number;
  available: number;
};

type Table<R> = { Row: R; Insert: Partial<R>; Update: Partial<R>; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      families: Table<FamilyRow>;
      children: Table<ChildRow>;
      members: Table<MemberRow>;
      invite_codes: Table<InviteCodeRow>;
      devices: Table<DeviceRow>;
      tasks: Table<TaskRow>;
      recurrences: Table<RecurrenceRow>;
      goals: Table<GoalRow>;
      rewards: Table<RewardRow>;
      point_transactions: Table<PointTransactionRow>;
      reward_requests: Table<RewardRequestRow>;
      activity_log: Table<ActivityLogRow>;
    };
    Views: {
      child_balances: { Row: ChildBalanceRow; Relationships: [] };
    };
    Functions: {
      complete_task: { Args: { p_task_id: string; p_tx_id: string }; Returns: undefined };
      uncomplete_task: { Args: { p_task_id: string; p_tx_id: string }; Returns: undefined };
      request_reward: { Args: { p_reward_id: string; p_request_id: string }; Returns: undefined };
      cancel_reward_request: { Args: { p_request_id: string }; Returns: undefined };
      approve_reward_request: { Args: { p_request_id: string; p_tx_id: string }; Returns: undefined };
      reject_reward_request: { Args: { p_request_id: string; p_note?: string }; Returns: undefined };
      adjust_points: {
        Args: { p_child_id: string; p_delta: number; p_note: string; p_tx_id: string };
        Returns: undefined;
      };
      create_family: {
        Args: { p_name: string; p_display_name: string; p_timezone?: string };
        Returns: string;
      };
      create_invite: { Args: { p_child_id?: string; p_role?: MemberRole }; Returns: string };
      redeem_invite: {
        Args: { p_code: string; p_display_name?: string; p_extra_key?: string };
        Returns: string | null;
      };
      register_device: { Args: { p_token: string; p_platform: string }; Returns: string };
      revoke_device: { Args: { p_device_id: string }; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
