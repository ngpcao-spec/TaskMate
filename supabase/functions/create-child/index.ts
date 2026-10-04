// Edge Function `create-child` : le PARENT crée le compte (identifiant + mot de passe) d'un enfant de sa famille.
import { createChildAccount } from '../_shared/child-accounts.ts';
import { serveChildAccountFunction } from '../_shared/child-accounts-runtime.ts';

serveChildAccountFunction(createChildAccount);
