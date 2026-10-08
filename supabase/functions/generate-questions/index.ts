// Edge Function `generate-questions` (D-057) : le PARENT envoie un document (photo, PDF, Word) ; une IA en tire des questions à choix
// multiple, enregistrées en BROUILLON pour UN enfant de sa famille. Le fichier n'est jamais conservé ni journalisé.
//   POST : génération.   GET : { configured, model, usedToday, dailyLimit } (diagnostic).
// La clé OPENAI_API_KEY (et, en option, OPENAI_MODEL / OPENAI_REASONING_EFFORT / GENERATE_DAILY_LIMIT / GENERATE_MAX_QUESTIONS) vient UNIQUEMENT de l'environnement des fonctions (Supabase → Edge Functions → Secrets) : jamais dans le code ni dans git.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { jsonResponse, preflight } from '../_shared/cors.ts';
import { AiError, buildOpenAiRequest, DEFAULT_MODEL, handleGenerate, handleStatus, LIMITS, OPENAI_RESPONSES_URL, parseOpenAiResponse, resolveMaxQuestions, type AiClient, type Deps, type Target } from './logic.ts';

const MAX_BODY_BYTES = Math.ceil((LIMITS.maxTotalBytes * 4) / 3) + 200_000;

/** Client réel : appel HTTP direct à l'API OpenAI (Responses), côté serveur seulement. Seul le type d'erreur est journalisé, jamais de contenu. */
function realAiClient(apiKey: string, effort: string | null): AiClient {
  return {
    complete: async (req) => {
      let res: Response;
      try {
        res = await fetch(OPENAI_RESPONSES_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(buildOpenAiRequest(req, effort)),
          signal: AbortSignal.timeout(req.timeoutMs),
        });
      } catch (e) {
        const name = (e as { name?: string })?.name ?? '';
        if (name === 'TimeoutError' || name === 'AbortError') throw new AiError('timeout');
        console.error('generate-questions: erreur réseau IA', name);
        throw new AiError('other');
      }
      if (!res.ok) {
        console.error('generate-questions: erreur IA', res.status);
        throw new AiError('http', res.status);
      }
      try {
        return parseOpenAiResponse(await res.json());
      } catch {
        throw new AiError('other');
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

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  const limit = Number(Deno.env.get('GENERATE_DAILY_LIMIT'));
  const deps: Deps = {
    target: async (childId) => {
      const { data, error } = await asCaller.rpc('ai_target', childId ? { p_child: childId } : {});
      return { data: (data as Target | null) ?? null, error };
    },
    reserve: async (familyId, memberId, dailyLimit, setId, retry) => {
      const { data, error } = await admin.rpc('ai_reserve', { p_family: familyId, p_member: memberId, p_limit: dailyLimit, p_set: setId, p_retry: retry });
      const row = (data as { usage_id: string | null; allowed: boolean; used: number; free: boolean }[] | null)?.[0];
      return error || !row ? null : { usageId: row.usage_id, allowed: row.allowed, used: row.used, free: row.free };
    },
    finish: async (usageId, status, failure, model, inputTokens, outputTokens) => {
      await admin.rpc('ai_finish', { p_id: usageId, p_status: status, p_failure: failure ?? '', p_model: model, p_input: inputTokens, p_output: outputTokens });
    },
    usageToday: async (familyId) => {
      const { data } = await admin.rpc('ai_usage_today', { p_family: familyId });
      return Number(data ?? 0);
    },
    saveDraft: async (setId, childId, title, subject, questions, kind, detected, replace) => {
      const { error } = await asCaller.rpc('create_quiz_draft', {
        p_set: setId,
        p_child: childId,
        p_title: title,
        p_subject: subject ?? '',
        p_questions: questions.map((q) => ({ prompt: q.prompt, choices: q.choices, correct: q.correct, explanation: q.explanation, number: q.number, needs_figure: q.needsFigure, to_verify: q.toVerify })),
        p_kind: kind,
        p_kind_detected: detected,
        p_replace: replace,
      });
      return { error };
    },
    ai: apiKey ? realAiClient(apiKey, Deno.env.get('OPENAI_REASONING_EFFORT') ?? 'low') : null,
    model: Deno.env.get('OPENAI_MODEL') || DEFAULT_MODEL,
    dailyLimit: Number.isInteger(limit) && limit > 0 ? limit : LIMITS.defaultDailyLimit,
    maxQuestions: resolveMaxQuestions(Deno.env.get('GENERATE_MAX_QUESTIONS')),
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
