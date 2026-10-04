// Edge Function `delete-child` : le PARENT supprime le compte d'un enfant de sa famille (et, au choix, son profil).
import { deleteChildAccount } from '../_shared/child-accounts.ts';
import { serveChildAccountFunction } from '../_shared/child-accounts-runtime.ts';

serveChildAccountFunction(deleteChildAccount);
