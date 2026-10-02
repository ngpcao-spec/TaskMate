import { useEffect, useState } from 'react';

/** Date courante rafraîchie toutes les `intervalMs` (défaut 1 min) : « en retard » se met à jour seul. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
