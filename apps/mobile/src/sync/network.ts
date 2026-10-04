import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { AppState } from 'react-native';

let installed = false;

/** Branche l'état réseau (NetInfo) et le retour au premier plan (AppState) sur TanStack Query. */
export function setupNetworkListeners(): void {
  if (installed) return;
  installed = true;
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => setOnline(state.isConnected !== false && state.isInternetReachable !== false)),
  );
  focusManager.setEventListener((handleFocus) => {
    const sub = AppState.addEventListener('change', (status) => {
      handleFocus(status === 'active');
    });
    return () => sub.remove();
  });
}
