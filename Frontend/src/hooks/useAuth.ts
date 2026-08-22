import { useCallback, useState } from 'react';
import { authApi } from '../api/auth.api';
import { storage } from '../utils/storage';
import type { AuthUsuario, LoginRequest } from '../types';

interface UseAuthReturn {
  loading: boolean;
  error: string | null;
  login: (credentials: LoginRequest) => Promise<AuthUsuario>;
  logout: () => Promise<void>;
}

export function useAuthActions(): UseAuthReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (credentials: LoginRequest) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authApi.login(credentials);
      await storage.setToken(response.token);
      await storage.setUser(JSON.stringify(response.usuario));
      return response.usuario;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesión';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await storage.clear();
  }, []);

  return { loading, error, login, logout };
}
