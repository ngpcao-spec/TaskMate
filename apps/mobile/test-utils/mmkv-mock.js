/* global jest */
// Stockage MMKV en mémoire pour Jest : `theme/themeStore` lit le thème au chargement des jetons, donc `sync/storage` doit pouvoir être importé partout.
// Les tests qui simulent `@/sync/storage` eux-mêmes ne sont pas affectés.
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => {
    const m = new Map();
    return { getString: (k) => m.get(k), set: (k, v) => void m.set(k, v), remove: (k) => m.delete(k), clearAll: () => m.clear(), getAllKeys: () => [...m.keys()] };
  },
}));
