import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { kvStorage } from './storage';

export const persister = createSyncStoragePersister({
  storage: kvStorage,
  key: 'taskmate-query-cache',
  throttleTime: 1000,
});
