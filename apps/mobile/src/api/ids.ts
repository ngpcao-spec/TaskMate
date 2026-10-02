import { randomUUID } from 'expo-crypto';

/** UUID généré côté client : identifie les écritures idempotentes (tx_id, request_id, ids de tâche). */
export const newId = (): string => randomUUID();
