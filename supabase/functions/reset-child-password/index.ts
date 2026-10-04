// Edge Function `reset-child-password` : le PARENT change le mot de passe d'un enfant de sa famille.
import { resetChildPassword } from '../_shared/child-accounts.ts';
import { serveChildAccountFunction } from '../_shared/child-accounts-runtime.ts';

serveChildAccountFunction(resetChildPassword);
