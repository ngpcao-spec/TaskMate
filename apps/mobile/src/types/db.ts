
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activity_log": {
                  Row: {
                    "actor_member_id": string | null,"child_id": string | null,"created_at": string,"family_id": string,"id": string,"payload": NonNullable<Json>,"type": string
                  }
                  Insert: {
                    "actor_member_id"?: string | null,"child_id"?: string | null,"created_at"?: string,"family_id": string,"id"?: string,"payload"?: NonNullable<Json>,"type": string
                  }
                  Update: {
                    "actor_member_id"?: string | null,"child_id"?: string | null,"created_at"?: string,"family_id"?: string,"id"?: string,"payload"?: NonNullable<Json>,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activity_log_actor_member_id_fkey"
      columns: ["actor_member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activity_log_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"auth_attempts": {
                  Row: {
                    "created_at": string,"id": number,"key": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: never,"key": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"key"?: string
                  }
                  Relationships: [
                    
                  ]
                },"child_accounts": {
                  Row: {
                    "auth_email": string,"child_id": string,"created_at": string,"family_id": string,"id": string,"login_id": string,"member_id": string,"password_hash": string | null
                  }
                  Insert: {
                    "auth_email": string,"child_id": string,"created_at"?: string,"family_id": string,"id"?: string,"login_id": string,"member_id": string,"password_hash"?: string | null
                  }
                  Update: {
                    "auth_email"?: string,"child_id"?: string,"created_at"?: string,"family_id"?: string,"id"?: string,"login_id"?: string,"member_id"?: string,"password_hash"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "child_accounts_child_id_family_id_fkey"
      columns: ["child_id","family_id"]
isOneToOne: false
      referencedRelation: "child_balances"
      referencedColumns: ["child_id","family_id"]
    },{
      foreignKeyName: "child_accounts_child_id_family_id_fkey"
      columns: ["child_id","family_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "child_accounts_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "child_accounts_member_id_fkey"
      columns: ["member_id"]
isOneToOne: true
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"children": {
                  Row: {
                    "avatar": string | null,"birth_date": string,"color": string | null,"created_at": string,"deleted_at": string | null,"family_id": string,"id": string,"label": string | null,"name": string,"sort_order": number,"updated_at": string
                  }
                  Insert: {
                    "avatar"?: string | null,"birth_date": string,"color"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"family_id": string,"id"?: string,"label"?: string | null,"name": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "avatar"?: string | null,"birth_date"?: string,"color"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"family_id"?: string,"id"?: string,"label"?: string | null,"name"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "children_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"devices": {
                  Row: {
                    "created_at": string,"expo_push_token": string | null,"id": string,"last_seen_at": string,"member_id": string,"platform": string | null,"revoked_at": string | null,"updated_at": string,"web_push_subscription": Json | null
                  }
                  Insert: {
                    "created_at"?: string,"expo_push_token"?: string | null,"id"?: string,"last_seen_at"?: string,"member_id": string,"platform"?: string | null,"revoked_at"?: string | null,"updated_at"?: string,"web_push_subscription"?: Json | null
                  }
                  Update: {
                    "created_at"?: string,"expo_push_token"?: string | null,"id"?: string,"last_seen_at"?: string,"member_id"?: string,"platform"?: string | null,"revoked_at"?: string | null,"updated_at"?: string,"web_push_subscription"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "devices_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"families": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"id": string,"name": string,"timezone": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"id"?: string,"name": string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"id"?: string,"name"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"goals": {
                  Row: {
                    "achieved_at": string | null,"child_id": string,"created_at": string,"created_by": string,"deleted_at": string | null,"family_id": string,"icon": string,"id": string,"progress": number,"target": number,"title": string,"unit": string | null,"updated_at": string
                  }
                  Insert: {
                    "achieved_at"?: string | null,"child_id": string,"created_at"?: string,"created_by": string,"deleted_at"?: string | null,"family_id": string,"icon"?: string,"id"?: string,"progress"?: number,"target": number,"title": string,"unit"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "achieved_at"?: string | null,"child_id"?: string,"created_at"?: string,"created_by"?: string,"deleted_at"?: string | null,"family_id"?: string,"icon"?: string,"id"?: string,"progress"?: number,"target"?: number,"title"?: string,"unit"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "goals_child_id_family_id_fkey"
      columns: ["child_id","family_id"]
isOneToOne: false
      referencedRelation: "child_balances"
      referencedColumns: ["child_id","family_id"]
    },{
      foreignKeyName: "goals_child_id_family_id_fkey"
      columns: ["child_id","family_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "goals_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "goals_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"members": {
                  Row: {
                    "child_id": string | null,"created_at": string,"deleted_at": string | null,"display_name": string,"family_id": string,"id": string,"revoked_at": string | null,"role": Database["public"]['Enums']["member_role"],"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "child_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"display_name": string,"family_id": string,"id"?: string,"revoked_at"?: string | null,"role": Database["public"]['Enums']["member_role"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "child_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"display_name"?: string,"family_id"?: string,"id"?: string,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["member_role"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "members_child_id_family_id_fkey"
      columns: ["child_id","family_id"]
isOneToOne: false
      referencedRelation: "child_balances"
      referencedColumns: ["child_id","family_id"]
    },{
      foreignKeyName: "members_child_id_family_id_fkey"
      columns: ["child_id","family_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "members_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_prefs": {
                  Row: {
                    "member_id": string,"prefs": NonNullable<Json>,"updated_at": string
                  }
                  Insert: {
                    "member_id": string,"prefs"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "member_id"?: string,"prefs"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_prefs_member_id_fkey"
      columns: ["member_id"]
isOneToOne: true
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"parent_invites": {
                  Row: {
                    "code_hash": string,"created_at": string,"created_by": string,"expires_at": string,"family_id": string,"id": string,"revoked_at": string | null,"used_at": string | null,"used_by": string | null
                  }
                  Insert: {
                    "code_hash": string,"created_at"?: string,"created_by": string,"expires_at": string,"family_id": string,"id"?: string,"revoked_at"?: string | null,"used_at"?: string | null,"used_by"?: string | null
                  }
                  Update: {
                    "code_hash"?: string,"created_at"?: string,"created_by"?: string,"expires_at"?: string,"family_id"?: string,"id"?: string,"revoked_at"?: string | null,"used_at"?: string | null,"used_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "parent_invites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "parent_invites_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "parent_invites_used_by_fkey"
      columns: ["used_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"point_transactions": {
                  Row: {
                    "child_id": string,"created_at": string,"created_by": string,"delta": number,"family_id": string,"id": string,"note": string | null,"reason": Database["public"]['Enums']["point_reason"],"ref_id": string | null
                  }
                  Insert: {
                    "child_id": string,"created_at"?: string,"created_by": string,"delta": number,"family_id": string,"id": string,"note"?: string | null,"reason": Database["public"]['Enums']["point_reason"],"ref_id"?: string | null
                  }
                  Update: {
                    "child_id"?: string,"created_at"?: string,"created_by"?: string,"delta"?: number,"family_id"?: string,"id"?: string,"note"?: string | null,"reason"?: Database["public"]['Enums']["point_reason"],"ref_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "point_transactions_child_id_family_id_fkey"
      columns: ["child_id","family_id"]
isOneToOne: false
      referencedRelation: "child_balances"
      referencedColumns: ["child_id","family_id"]
    },{
      foreignKeyName: "point_transactions_child_id_family_id_fkey"
      columns: ["child_id","family_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "point_transactions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "point_transactions_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"recurrences": {
                  Row: {
                    "category": Database["public"]['Enums']["task_category"],"child_id": string,"created_at": string,"created_by": string,"deleted_at": string | null,"end_time": string | null,"ends_on": string | null,"family_id": string,"id": string,"note": string | null,"points": number,"rule": Database["public"]['Enums']["recurrence_rule"],"start_time": string | null,"starts_on": string,"time_kind": Database["public"]['Enums']["time_kind"],"title": string,"updated_at": string,"weekdays": (number)[] | null
                  }
                  Insert: {
                    "category"?: Database["public"]['Enums']["task_category"],"child_id": string,"created_at"?: string,"created_by": string,"deleted_at"?: string | null,"end_time"?: string | null,"ends_on"?: string | null,"family_id": string,"id"?: string,"note"?: string | null,"points"?: number,"rule": Database["public"]['Enums']["recurrence_rule"],"start_time"?: string | null,"starts_on": string,"time_kind": Database["public"]['Enums']["time_kind"],"title": string,"updated_at"?: string,"weekdays"?: (number)[] | null
                  }
                  Update: {
                    "category"?: Database["public"]['Enums']["task_category"],"child_id"?: string,"created_at"?: string,"created_by"?: string,"deleted_at"?: string | null,"end_time"?: string | null,"ends_on"?: string | null,"family_id"?: string,"id"?: string,"note"?: string | null,"points"?: number,"rule"?: Database["public"]['Enums']["recurrence_rule"],"start_time"?: string | null,"starts_on"?: string,"time_kind"?: Database["public"]['Enums']["time_kind"],"title"?: string,"updated_at"?: string,"weekdays"?: (number)[] | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "recurrences_child_id_family_id_fkey"
      columns: ["child_id","family_id"]
isOneToOne: false
      referencedRelation: "child_balances"
      referencedColumns: ["child_id","family_id"]
    },{
      foreignKeyName: "recurrences_child_id_family_id_fkey"
      columns: ["child_id","family_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "recurrences_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recurrences_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"reward_requests": {
                  Row: {
                    "child_id": string,"cost": number,"created_at": string,"decided_at": string | null,"decided_by": string | null,"decision_note": string | null,"expires_at": string,"family_id": string,"id": string,"requested_by": string,"reward_id": string,"reward_title": string,"status": Database["public"]['Enums']["request_status"],"updated_at": string
                  }
                  Insert: {
                    "child_id": string,"cost": number,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"expires_at": string,"family_id": string,"id": string,"requested_by": string,"reward_id": string,"reward_title": string,"status"?: Database["public"]['Enums']["request_status"],"updated_at"?: string
                  }
                  Update: {
                    "child_id"?: string,"cost"?: number,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"expires_at"?: string,"family_id"?: string,"id"?: string,"requested_by"?: string,"reward_id"?: string,"reward_title"?: string,"status"?: Database["public"]['Enums']["request_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reward_requests_child_id_family_id_fkey"
      columns: ["child_id","family_id"]
isOneToOne: false
      referencedRelation: "child_balances"
      referencedColumns: ["child_id","family_id"]
    },{
      foreignKeyName: "reward_requests_child_id_family_id_fkey"
      columns: ["child_id","family_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "reward_requests_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reward_requests_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reward_requests_requested_by_fkey"
      columns: ["requested_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reward_requests_reward_id_fkey"
      columns: ["reward_id"]
isOneToOne: false
      referencedRelation: "rewards"
      referencedColumns: ["id"]
    }
                  ]
                },"rewards": {
                  Row: {
                    "child_id": string | null,"cost": number,"created_at": string,"deleted_at": string | null,"family_id": string,"icon": string,"id": string,"sort_order": number,"title": string,"updated_at": string
                  }
                  Insert: {
                    "child_id"?: string | null,"cost": number,"created_at"?: string,"deleted_at"?: string | null,"family_id": string,"icon"?: string,"id"?: string,"sort_order"?: number,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "child_id"?: string | null,"cost"?: number,"created_at"?: string,"deleted_at"?: string | null,"family_id"?: string,"icon"?: string,"id"?: string,"sort_order"?: number,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rewards_child_id_family_id_fkey"
      columns: ["child_id","family_id"]
isOneToOne: false
      referencedRelation: "child_balances"
      referencedColumns: ["child_id","family_id"]
    },{
      foreignKeyName: "rewards_child_id_family_id_fkey"
      columns: ["child_id","family_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "rewards_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "category": Database["public"]['Enums']["task_category"],"child_id": string,"completed_at": string | null,"completed_by": string | null,"created_at": string,"created_by": string,"date": string,"deleted_at": string | null,"end_time": string | null,"family_id": string,"id": string,"note": string | null,"points": number,"recurrence_id": string | null,"rejected_at": string | null,"rejection_note": string | null,"start_time": string | null,"time_kind": Database["public"]['Enums']["time_kind"],"title": string,"updated_at": string,"validated_at": string | null,"validated_by": string | null
                  }
                  Insert: {
                    "category"?: Database["public"]['Enums']["task_category"],"child_id": string,"completed_at"?: string | null,"completed_by"?: string | null,"created_at"?: string,"created_by": string,"date": string,"deleted_at"?: string | null,"end_time"?: string | null,"family_id": string,"id"?: string,"note"?: string | null,"points"?: number,"recurrence_id"?: string | null,"rejected_at"?: string | null,"rejection_note"?: string | null,"start_time"?: string | null,"time_kind"?: Database["public"]['Enums']["time_kind"],"title": string,"updated_at"?: string,"validated_at"?: string | null,"validated_by"?: string | null
                  }
                  Update: {
                    "category"?: Database["public"]['Enums']["task_category"],"child_id"?: string,"completed_at"?: string | null,"completed_by"?: string | null,"created_at"?: string,"created_by"?: string,"date"?: string,"deleted_at"?: string | null,"end_time"?: string | null,"family_id"?: string,"id"?: string,"note"?: string | null,"points"?: number,"recurrence_id"?: string | null,"rejected_at"?: string | null,"rejection_note"?: string | null,"start_time"?: string | null,"time_kind"?: Database["public"]['Enums']["time_kind"],"title"?: string,"updated_at"?: string,"validated_at"?: string | null,"validated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_child_id_family_id_fkey"
      columns: ["child_id","family_id"]
isOneToOne: false
      referencedRelation: "child_balances"
      referencedColumns: ["child_id","family_id"]
    },{
      foreignKeyName: "tasks_child_id_family_id_fkey"
      columns: ["child_id","family_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id","family_id"]
    },{
      foreignKeyName: "tasks_completed_by_fkey"
      columns: ["completed_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_recurrence_id_fkey"
      columns: ["recurrence_id"]
isOneToOne: false
      referencedRelation: "recurrences"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_validated_by_fkey"
      columns: ["validated_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "child_balances": {
                  Row: {
                    "available": number | null,"balance": number | null,"child_id": string | null,"family_id": string | null,"pending_task_points": number | null,"reserved": number | null
                  }
                  Insert: {
                           "available"?: never,"balance"?: never,"child_id"?: string | null,"family_id"?: string | null,"pending_task_points"?: never,"reserved"?: never
                         }
                        Update: {
                           "available"?: never,"balance"?: never,"child_id"?: string | null,"family_id"?: string | null,"pending_task_points"?: never,"reserved"?: never
                         }
                        Relationships: [
                    {
      foreignKeyName: "children_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "adjust_points":
{ Args: { "p_child_id": string,"p_delta": number,"p_note": string,"p_tx_id": string }; Returns: undefined
                           },
"approve_reward_request":
{ Args: { "p_request_id": string,"p_tx_id": string }; Returns: undefined
                           },
"cancel_reward_request":
{ Args: { "p_request_id": string }; Returns: undefined
                           },
"child_account_target":
{ Args: { "p_child_id": string }; Returns: Json
                           },
"child_balance":
{ Args: { "p_child": string }; Returns: number
                           },
"child_login_check_password":
{ Args: { "p_auth_email": string,"p_password": string }; Returns: boolean
                           },
"child_login_prepare":
{ Args: { "p_ip": string,"p_login_id": string,"p_parent_email": string }; Returns: Json
                           },
"child_login_record_failure":
{ Args: { "p_family_key": string,"p_ip_key": string }; Returns: undefined
                           },
"child_pending_task_points":
{ Args: { "p_child": string }; Returns: number
                           },
"child_reserved":
{ Args: { "p_child": string }; Returns: number
                           },
"complete_task":
{ Args: { "p_task_id": string,"p_tx_id": string }; Returns: undefined
                           },
"create_family":
{ Args: { "p_display_name": string,"p_name": string,"p_timezone"?: string }; Returns: string
                           },
"create_parent_invite":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"delete_family":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"diagnostics":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"expire_reward_requests":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"family_today":
{ Args: { "p_family": string,"p_now"?: string }; Returns: string
                           },
"generate_all_recurrences":
{ Args: { "p_now"?: string }; Returns: number
                           },
"generate_recurrence":
{ Args: { "p_now"?: string,"p_recurrence": string }; Returns: number
                           },
"is_google_account":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_parent":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"join_family_with_code":
{ Args: { "p_code": string,"p_display_name": string }; Returns: string
                           },
"leave_family":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"log_activity":
{ Args: { "p_actor": string,"p_child": string,"p_family": string,"p_payload": Json,"p_type": string }; Returns: undefined
                           },
"migrate_legacy_child_accounts":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"my_child_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"my_family_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"my_member_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"my_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["member_role"]
                           },
"recurrence_matches":
{ Args: { "p_day": string,"r": Database["public"]['Tables']["recurrences"]['Row'] }; Returns: boolean
                           },
"register_child_account":
{ Args: { "p_auth_email": string,"p_child_id": string,"p_login_id": string,"p_password": string,"p_user_id": string }; Returns: string
                           },
"register_device":
{ Args: { "p_platform": string,"p_token": string }; Returns: string
                           },
"register_web_push":
{ Args: { "p_subscription": Json }; Returns: string
                           },
"reject_reward_request":
{ Args: { "p_note"?: string,"p_request_id": string }; Returns: undefined
                           },
"reject_task":
{ Args: { "p_note"?: string,"p_task_id": string }; Returns: undefined
                           },
"remove_child_account":
{ Args: { "p_child_id": string }; Returns: string
                           },
"request_reward":
{ Args: { "p_request_id": string,"p_reward_id": string }; Returns: undefined
                           },
"require_member":
{ Args: Record<PropertyKey, never>; Returns: {
              "child_id": string | null,
"created_at": string,
"deleted_at": string | null,
"display_name": string,
"family_id": string,
"id": string,
"revoked_at": string | null,
"role": Database["public"]['Enums']["member_role"],
"updated_at": string,
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "members"
        isOneToOne: true
        isSetofReturn: false
      } },
"revoke_device":
{ Args: { "p_device_id": string }; Returns: undefined
                           },
"revoke_parent_invite":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"schedule_cron_jobs":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"set_child_password":
{ Args: { "p_child_id": string,"p_password": string }; Returns: undefined
                           },
"sync_recurrence":
{ Args: { "p_now"?: string,"p_recurrence": string }; Returns: undefined
                           },
"uncomplete_task":
{ Args: { "p_task_id": string,"p_tx_id": string }; Returns: undefined
                           },
"unregister_web_push":
{ Args: { "p_endpoint": string }; Returns: undefined
                           },
"validate_task":
{ Args: { "p_task_id": string,"p_tx_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "member_role": "parent"|"child","point_reason": "task_validated"|"task_unvalidated"|"reward_redeemed"|"manual_adjust","recurrence_rule": "daily"|"weekdays","request_status": "pending"|"approved"|"rejected"|"cancelled"|"expired","task_category": "study"|"sport"|"chores"|"personal"|"other","time_kind": "range"|"deadline"|"anytime"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "member_role": ["parent", "child"],"point_reason": ["task_validated", "task_unvalidated", "reward_redeemed", "manual_adjust"],"recurrence_rule": ["daily", "weekdays"],"request_status": ["pending", "approved", "rejected", "cancelled", "expired"],"task_category": ["study", "sport", "chores", "personal", "other"],"time_kind": ["range", "deadline", "anytime"]
          }
        }
} as const
