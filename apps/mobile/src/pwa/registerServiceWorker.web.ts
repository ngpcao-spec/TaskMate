export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || __DEV__) return;
  const register = () => void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
