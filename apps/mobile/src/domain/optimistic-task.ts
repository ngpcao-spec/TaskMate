import type { TaskInsertFields } from './task-form';
import type { TaskRow } from '@/types/db';

/** Ligne affichée tout de suite après « Lưu », avant l'écho du serveur (création hors ligne comprise). */
export function optimisticTask(
  fields: TaskInsertFields & { id: string },
  ctx: { familyId: string; memberId: string; nowIso: string },
): TaskRow {
  return {
    ...fields,
    family_id: ctx.familyId,
    completed_at: null,
    completed_by: null,
    recurrence_id: null,
    created_by: ctx.memberId,
    created_at: ctx.nowIso,
    updated_at: ctx.nowIso,
    deleted_at: null,
  };
}

/** Une liste en cache `[from, to]` doit-elle contenir la tâche de ce jour ? */
export const dateInRange = (date: string, from: string, to: string): boolean => date >= from && date <= to;
