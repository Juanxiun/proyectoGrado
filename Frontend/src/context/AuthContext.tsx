import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { storage } from '../utils/storage';
import { useAuthActions } from '../hooks/useAuth';
import type { AuthUsuario, LoginResponse } from '../types';

interface AuthContextValue {
  user: AuthUsuario | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<LoginResponse>;
  verify2FA: (code: string) => Promise<void>;
  resend2FA: () => Promise<void>;
  pending2FA: { tempToken: string; emailMasked?: string; expiresInSeconds?: number } | null;
  logout: () => Promise<void>;
  updateLocalUser: (updates: Partial<AuthUsuario>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUsuario | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { login: authLogin, verify2FA: authVerify2FA, resend2FA: authResend2FA, logout: authLogout } = useAuthActions();
  const [pending2FA, setPending2FA] = useState<AuthContextValue['pending2FA']>(null);

  useEffect(() => {
    (async () => {
      try {
        const stored = await storage.getUser();
        if (stored) setUser(JSON.parse(stored) as AuthUsuario);
      } catch {
        await storage.clear();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const response = await authLogin({ login: username, password });
      if (response.requires2FA && response.tempToken) {
        setPending2FA({ tempToken: response.tempToken, emailMasked: response.emailMasked, expiresInSeconds: response.expiresInSeconds });
      } else if (response.usuario) setUser(response.usuario);
      return response;
    },
    [authLogin],
  );

  const verify2FA = useCallback(async (code: string) => {
    if (!pending2FA) throw new Error('No hay una verificación 2FA pendiente');
    const response = await authVerify2FA(pending2FA.tempToken, code);
    if (!response.usuario) throw new Error('Respuesta de autenticación incompleta');
    setUser(response.usuario);
    setPending2FA(null);
  }, [authVerify2FA, pending2FA]);

  const resend2FA = useCallback(async () => {
    if (pending2FA) await authResend2FA(pending2FA.tempToken);
  }, [authResend2FA, pending2FA]);

  const logout = useCallback(async () => {
    await authLogout();
    setUser(null);
    setPending2FA(null);
  }, [authLogout]);

  const updateLocalUser = useCallback((updates: Partial<AuthUsuario>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      storage.setUser(JSON.stringify(updated));
      return updated;
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      updateLocalUser,
      verify2FA,
      resend2FA,
      pending2FA,
    }),
    [user, isLoading, login, logout, updateLocalUser, verify2FA, resend2FA, pending2FA],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
