// Edge Function `generate-avatar` (D-071) : le PARENT ou l'ENFANT envoie un portrait ; une IA le transforme en avatar « dessin animé »,
// enregistré comme CANDIDAT (à valider par l'utilisateur). Le portrait n'est jamais conservé ni journalisé ; seul le dessin l'est.
//   POST { childId?, image (base64) } → { candidate (WebP base64), child_id, remaining }
// Nécessite le consentement du parent pour l'enfant (RPC set_avatar_ai_allowed).
// La clé OPENAI_API_KEY (et, en option, OPENAI_IMAGE_MODEL / OPENAI_IMAGE_QUALITY / AVATAR_CHILD_DAILY_LIMIT / AVATAR_FAMILY_DAILY_LIMIT) vient
// UNIQUEMENT de l'environnement des fonctions (Supabase → Edge Functions → Secrets) : jamais dans le code ni dans git.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { jsonResponse, preflight } from '../_shared/cors.ts';
import { AiError, buildOpenAiFields, DEFAULT_IMAGE_MODEL, handleGenerate, isModerationCode, LIMITS, OPENAI_IMAGES_EDIT_URL, parseOpenAiImageResponse, resolveLimit, resolveQuality, type AiClient, type Deps, type Target } from './logic.ts';

const MAX_BODY_BYTES = Math.ceil((LIMITS.maxImageBytes * 4) / 3) + 10_000;

/** Client réel : appel HTTP direct à l'API OpenAI (images/edits), côté serveur seulement. Seul un code d'erreur est journalisé, jamais de contenu. */
function realAiClient(apiKey: string): AiClient {
  return {
    generate: async (req) => {
      const form = new FormData();
      for (const [key, value] of Object.entries(buildOpenAiFields(req))) form.append(key, value);
      const extension = req.photo.mediaType === 'image/png' ? 'png' : req.photo.mediaType === 'image/webp' ? 'webp' : 'jpg';
      form.append('image', new Blob([req.photo.bytes], { type: req.photo.mediaType }), `portrait.${extension}`);
      let res: Response;
      try {
        res = await fetch(OPENAI_IMAGES_EDIT_URL, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form, signal: AbortSignal.timeout(req.timeoutMs) });
      } catch (e) {
        const name = (e as { name?: string })?.name ?? '';
        if (name === 'TimeoutError' || name === 'AbortError') throw new AiError('timeout');
        console.error('generate-avatar: erreur réseau IA', name);
        throw new AiError('other');
      }
      if (!res.ok) {
        let code: unknown = null;
        try {
          code = ((await res.json()) as { error?: { code?: unknown } })?.error?.code;
        } catch {
          /* corps illisible */
        }
        console.error('generate-avatar: erreur IA', res.status, typeof code === 'string' ? code : '');
        throw isModerationCode(code) ? new AiError('refused', res.status) : new AiError('http', res.status);
      }
      try {
        return parseOpenAiImageResponse(await res.json());
      } catch {
        throw new AiError('other');
      }
    },
  };
}

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
  const authorization = req.headers.get('Authorization');
  if (!authorization) return jsonResponse({ error: 'not_authenticated' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  const deps: Deps = {
    target: async (childId) => {
      const { data, error } = await asCaller.rpc('avatar_target', childId ? { p_child: childId } : {});
      return { data: (data as Target | null) ?? null, error };
    },
    reserve: async (familyId, childId, memberId, limits) => {
      const { data, error } = await admin.rpc('avatar_reserve', { p_family: familyId, p_child: childId, p_member: memberId, p_child_limit: limits.child, p_family_limit: limits.family, p_hard: limits.hard });
      const row = (data as { usage_id: string | null; allowed: boolean; used: number }[] | null)?.[0];
      return error || !row ? null : { usageId: row.usage_id, allowed: row.allowed, used: row.used };
    },
    finish: async (usageId, status, failure, model) => {
      await admin.rpc('avatar_finish', { p_id: usageId, p_status: status, p_failure: failure ?? '', p_model: model });
    },
    saveCandidate: async (childId, familyId, b64) => {
      const { error } = await admin.rpc('avatar_save_candidate', { p_child: childId, p_family: familyId, p_b64: b64 });
      return { error };
    },
    ai: apiKey ? realAiClient(apiKey) : null,
    model: Deno.env.get('OPENAI_IMAGE_MODEL') || DEFAULT_IMAGE_MODEL,
    quality: resolveQuality(Deno.env.get('OPENAI_IMAGE_QUALITY')),
    childDailyLimit: resolveLimit(Deno.env.get('AVATAR_CHILD_DAILY_LIMIT'), LIMITS.defaultChildDailyLimit),
    familyDailyLimit: resolveLimit(Deno.env.get('AVATAR_FAMILY_DAILY_LIMIT'), LIMITS.defaultFamilyDailyLimit),
  };

  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) return jsonResponse({ error: 'file_too_large' }, 413);
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return jsonResponse({ error: 'file_too_large' }, 413);
  let body: unknown = {};
  try {
    body = JSON.parse(text);
  } catch {
    return jsonResponse({ error: 'invalid_input' }, 422);
  }
  const outcome = await handleGenerate(deps, body);
  return jsonResponse(outcome.body, outcome.status);
});
