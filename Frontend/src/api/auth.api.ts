import { apiRequest } from './client';
import type { LoginRequest, LoginResponse } from '../types';

export const authApi = {
  login: (credentials: LoginRequest) =>
    apiRequest<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: credentials,
      auth: false,
    }),
  verify2FA: (tempToken: string, code: string) =>
    apiRequest<LoginResponse>('/api/auth/verify-2fa', { method: 'POST', body: { tempToken, code }, auth: false }),
  resend2FA: (tempToken: string) =>
    apiRequest<{ message: string }>('/api/auth/resend-2fa', { method: 'POST', body: { tempToken }, auth: false }),
  logout: () => apiRequest<{ message?: string }>('/api/auth/logout', { method: 'POST' }),
};
