/** Rapport d'une erreur d'affichage (écran d'erreur racine, D-094) : texte court, sans donnée personnelle, pour être lu ou recopié par l'utilisateur. */
export type CrashReport = { at: string; path: string; name: string; message: string; stack: string[] };

export const CRASH_KEY = 'taskmate-last-error';
const STACK_LINES = 8;
const MAX = 300;

const clip = (text: string): string => (text.length > MAX ? `${text.slice(0, MAX)}…` : text);

/** Construit le rapport d'une erreur quelconque (jamais d'exception ici : l'écran d'erreur ne doit pas planter à son tour). */
export function crashReport(error: unknown, at: Date, path: string): CrashReport {
  const e = (typeof error === 'object' && error !== null ? error : {}) as { name?: unknown; message?: unknown; stack?: unknown };
  const stack = typeof e.stack === 'string' ? e.stack.split('\n').slice(0, STACK_LINES).map((l) => clip(l.trim())) : [];
  return {
    at: at.toISOString(),
    path: clip(path),
    name: clip(typeof e.name === 'string' && e.name !== '' ? e.name : 'Error'),
    message: clip(typeof e.message === 'string' && e.message !== '' ? e.message : typeof error === 'string' ? error : 'unknown'),
    stack,
  };
}

/** Texte à copier / lire : « Error: message » + début de la pile. */
export const crashText = (r: CrashReport): string => [`${r.name}: ${r.message}`, `${r.path} · ${r.at}`, ...r.stack].join('\n');
