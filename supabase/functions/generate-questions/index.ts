// Edge Function `generate-questions` (D-057) : le PARENT envoie un document (photo, PDF, Word) ; une IA en tire des questions à choix
// multiple, enregistrées en BROUILLON pour UN enfant de sa famille. Le fichier n'est jamais conservé ni journalisé.
//   POST : génération.   GET : { configured, model, usedToday, dailyLimit } (diagnostic).
// La clé ANTHROPIC_API_KEY vient UNIQUEMENT de l'environnement des fonctions (Supabase → Edge Functions → Secrets) : jamais dans le code ni dans git.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { jsonResponse, preflight } from '../_shared/cors.ts';
import { AiError, DEFAULT_MODEL, handleGenerate, handleStatus, LIMITS, type AiClient, type AiContent, type Deps, type Target } from './logic.ts';

const MAX_BODY_BYTES = Math.ceil((LIMITS.maxTotalBytes * 4) / 3) + 200_000;

/** Client réel : SDK officiel, importé à la demande (les chemins sans IA — statut, erreurs — ne le chargent jamais). */
function realAiClient(apiKey: string, effort: string | null): AiClient {
  return {
    complete: async (req) => {
      // deno-lint-ignore no-explicit-any
      const mod: any = await import('npm:@anthropic-ai/sdk@0.131.0');
      const Anthropic = mod.default;
      const client = new Anthropic({ apiKey, timeout: req.timeoutMs, maxRetries: 1 });
      const content = req.content.map((c: AiContent) =>
        c.type === 'text'
          ? { type: 'text', text: c.text }
          : c.type === 'image'
            ? { type: 'image', source: { type: 'base64', media_type: c.mediaType, data: c.data } }
            : { type: 'document', source: { type: 'base64', media_type: c.mediaType, data: c.data } },
      );
      try {
        const msg = await client.messages.create({
          model: req.model,
          max_tokens: req.maxTokens,
          system: req.system,
          messages: [{ role: 'user', content }],
          // niveau d'effort bas : la tâche est de la lecture et de la rédaction, pas du raisonnement ; ignoré pour les modèles qui ne le gèrent pas
          ...(effort && /^claude-(sonnet|opus|fable)-5/.test(req.model) ? { output_config: { effort } } : {}),
        });
        const text = (msg.content as { type: string; text?: string }[]).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
        return { text, stopReason: msg.stop_reason ?? null, inputTokens: msg.usage?.input_tokens ?? 0, outputTokens: msg.usage?.output_tokens ?? 0 };
      } catch (e) {
        // jamais de contenu dans les journaux : seulement le type d'erreur
        const name = (e as { name?: string })?.name ?? '';
        if (name === 'APIConnectionTimeoutError') throw new AiError('timeout');
        const status = (e as { status?: number })?.status;
        console.error('generate-questions: erreur IA', name, status ?? '');
        throw new AiError(typeof status === 'number' ? 'http' : 'other', typeof status === 'number' ? status : null);
      }
    },
  };
}

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  if (req.method !== 'POST' && req.method !== 'GET') return jsonResponse({ error: 'method_not_allowed' }, 405);
  const authorization = req.headers.get('Authorization');
  if (!authorization) return jsonResponse({ error: 'not_authenticated' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  const limit = Number(Deno.env.get('GENERATE_DAILY_LIMIT'));
  const deps: Deps = {
    target: async (childId) => {
      const { data, error } = await asCaller.rpc('ai_target', childId ? { p_child: childId } : {});
      return { data: (data as Target | null) ?? null, error };
    },
    reserve: async (familyId, memberId, dailyLimit) => {
      const { data, error } = await admin.rpc('ai_reserve', { p_family: familyId, p_member: memberId, p_limit: dailyLimit });
      const row = (data as { usage_id: string | null; allowed: boolean; used: number }[] | null)?.[0];
      return error || !row ? null : { usageId: row.usage_id, allowed: row.allowed, used: row.used };
    },
    finish: async (usageId, status, failure, model, inputTokens, outputTokens) => {
      await admin.rpc('ai_finish', { p_id: usageId, p_status: status, p_failure: failure ?? '', p_model: model, p_input: inputTokens, p_output: outputTokens });
    },
    usageToday: async (familyId) => {
      const { data } = await admin.rpc('ai_usage_today', { p_family: familyId });
      return Number(data ?? 0);
    },
    saveDraft: async (setId, childId, title, subject, questions) => {
      const { error } = await asCaller.rpc('create_quiz_draft', {
        p_set: setId,
        p_child: childId,
        p_title: title,
        p_subject: subject ?? '',
        p_questions: questions.map((q) => ({ prompt: q.prompt, choices: q.choices, correct: q.correct, explanation: q.explanation })),
      });
      return { error };
    },
    ai: apiKey ? realAiClient(apiKey, Deno.env.get('ANTHROPIC_EFFORT') ?? 'low') : null,
    model: Deno.env.get('ANTHROPIC_MODEL') || DEFAULT_MODEL,
    dailyLimit: Number.isInteger(limit) && limit > 0 ? limit : LIMITS.defaultDailyLimit,
  };

  if (req.method === 'GET') {
    const outcome = await handleStatus(deps);
    return jsonResponse(outcome.body, outcome.status);
  }
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
