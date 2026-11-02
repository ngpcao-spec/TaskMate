/** Lecture ou pause d'un élément `<video>` (web). Une promesse de lecture refusée par le navigateur (lecture automatique bloquée) est ignorée : le poster reste. */
export function syncPlayback(el: { play?: () => Promise<void> | void; pause?: () => void } | null, playing: boolean): void {
  if (!el || typeof el.play !== 'function' || typeof el.pause !== 'function') return;
  if (playing) void Promise.resolve(el.play()).catch(() => undefined);
  else el.pause();
}
