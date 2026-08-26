import { apiRequest } from './client';
import type { LoginRequest, LoginResponse } from '../types';

export const authApi = {
  login: (credentials: LoginRequest) =>
    apiRequest<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: credentials,
      auth: false,
    }),
};
