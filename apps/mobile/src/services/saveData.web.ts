/** `navigator.connection.saveData` (Chrome, Android) : vrai = l'utilisateur demande d'économiser les données (aucune vidéo d'accueil, D-106). */
export function prefersSaveData(): boolean {
  try {
    const nav = globalThis.navigator as (Navigator & { connection?: { saveData?: boolean } }) | undefined;
    return nav?.connection?.saveData === true;
  } catch {
    return false;
  }
}
