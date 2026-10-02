import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '@/i18n';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastHost } from '@/components/ToastHost';
import { useAuthListener } from '@/hooks/useMe';
import { createQueryClient, CACHE_MAX_AGE } from '@/sync/client';
import { setupNetworkListeners } from '@/sync/network';
import { persister } from '@/sync/persister';

setupNetworkListeners();
const queryClient = createQueryClient();

function Root() {
  useAuthListener();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="task/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="task/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="reward/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="reward/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="points-adjust" options={{ presentation: 'modal' }} />
        </Stack>
        <ToastHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: CACHE_MAX_AGE, buster: 'v1' }}
      // après relecture du cache : relance les écritures qui attendaient le réseau
      onSuccess={() => void queryClient.resumePausedMutations()}
    >
      <Root />
    </PersistQueryClientProvider>
  );
}
