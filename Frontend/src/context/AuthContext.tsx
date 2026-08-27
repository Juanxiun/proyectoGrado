import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { storage } from '../utils/storage';
import { useAuthActions } from '../hooks/useAuth';
import type { AuthUsuario } from '../types';

interface AuthContextValue {
  user: AuthUsuario | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<AuthUsuario>;
  logout: () => Promise<void>;
  updateLocalUser: (updates: Partial<AuthUsuario>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUsuario | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { login: authLogin, logout: authLogout } = useAuthActions();

  useEffect(() => {
    const syncUser = async () => {
      try {
        const storedUser = await storage.getUser();
        const storedToken = await storage.getToken();
        if (storedUser && storedToken) {
          setUser(JSON.parse(storedUser) as AuthUsuario);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    syncUser();
    const unsubscribe = storage.onAuthChange(() => {
      syncUser();
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const usuario = await authLogin({ login: username, password });
      setUser(usuario);
      return usuario;
    },
    [authLogin],
  );

  const logout = useCallback(async () => {
    await authLogout();
    setUser(null);
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
    }),
    [user, isLoading, login, logout, updateLocalUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
