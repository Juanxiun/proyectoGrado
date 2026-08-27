import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { STORAGE_KEYS } from '../constants/config';

const isWeb = Platform.OS === 'web';

type Listener = () => void;
const listeners = new Set<Listener>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

if (isWeb && typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (!e.key || e.key === STORAGE_KEYS.TOKEN || e.key === STORAGE_KEYS.USER) {
      notifyListeners();
    }
  });

  // Chequeo periódico en Web por si se borran las cookies/localStorage directamente en DevTools
  let prevToken = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.TOKEN) : null;
  setInterval(() => {
    const currentToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
    if (currentToken !== prevToken) {
      prevToken = currentToken;
      notifyListeners();
    }
  }, 1000);
}

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    localStorage.setItem(key, value);
    notifyListeners();
    return;
  }
  await SecureStore.setItemAsync(key, value);
  notifyListeners();
}

async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function removeItem(key: string): Promise<void> {
  if (isWeb) {
    localStorage.removeItem(key);
    notifyListeners();
    return;
  }
  await SecureStore.deleteItemAsync(key);
  notifyListeners();
}

export const storage = {
  setToken: (token: string) => setItem(STORAGE_KEYS.TOKEN, token),
  getToken: () => getItem(STORAGE_KEYS.TOKEN),
  removeToken: () => removeItem(STORAGE_KEYS.TOKEN),

  setUser: (user: string) => setItem(STORAGE_KEYS.USER, user),
  getUser: () => getItem(STORAGE_KEYS.USER),
  removeUser: () => removeItem(STORAGE_KEYS.USER),

  clear: async () => {
    await removeItem(STORAGE_KEYS.TOKEN);
    await removeItem(STORAGE_KEYS.USER);
    notifyListeners();
  },

  onAuthChange: (listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
