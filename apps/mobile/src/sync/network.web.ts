import { focusManager, onlineManager } from '@tanstack/react-query';

let installed = false;

/** Web : état réseau via navigator.onLine + événements online/offline, focus via visibilitychange. */
export function setupNetworkListeners(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  onlineManager.setEventListener((setOnline) => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  });
  focusManager.setEventListener((handleFocus) => {
    const onVisibility = () => handleFocus(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  });
}
