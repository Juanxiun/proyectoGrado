import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { STORAGE_KEYS } from '../constants/config';

const isWeb = Platform.OS === 'web';

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
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
    return;
  }
  await SecureStore.deleteItemAsync(key);
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
  },
};
