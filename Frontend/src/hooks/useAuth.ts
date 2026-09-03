import { useCallback, useState } from 'react';
import { authApi } from '../api/auth.api';
import { storage } from '../utils/storage';
import type { AuthUsuario, LoginRequest, LoginResponse } from '../types';

interface UseAuthReturn {
  loading: boolean;
  error: string | null;
  login: (credentials: LoginRequest) => Promise<LoginResponse>;
  verify2FA: (tempToken: string, code: string) => Promise<LoginResponse>;
  resend2FA: (tempToken: string) => Promise<void>;
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
      if (response.token && response.usuario) {
        await storage.setToken(response.token);
        await storage.setUser(JSON.stringify(response.usuario));
      }
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesión';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } finally { await storage.clear(); }
  }, []);

  const verify2FA = useCallback(async (tempToken: string, code: string) => {
    const response = await authApi.verify2FA(tempToken, code);
    if (response.token && response.usuario) {
      await storage.setToken(response.token);
      await storage.setUser(JSON.stringify(response.usuario));
    }
    return response;
  }, []);

  const resend2FA = useCallback(async (tempToken: string) => { await authApi.resend2FA(tempToken); }, []);

  return { loading, error, login, verify2FA, resend2FA, logout };
}
