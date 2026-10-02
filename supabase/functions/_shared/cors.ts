// CORS pour les Edge Functions appelées depuis le navigateur (web app TaskMate, W4) : le préflight OPTIONS
// est répondu sans authentification ; toutes les réponses portent les en-têtes CORS.
// Origine « * » : sans danger ici, car l'accès repose sur le JWT (en-tête Authorization), jamais sur un cookie.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
} as const;

/** Réponse au préflight, ou null si la requête n'est pas un OPTIONS. */
export function preflight(req: Request): Response | null {
  return req.method === 'OPTIONS' ? new Response(null, { status: 204, headers: corsHeaders }) : null;
}

export const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
