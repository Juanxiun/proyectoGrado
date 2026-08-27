import { wsClient } from './websocket.client';
import type { LoginRequest, LoginResponse } from '../types';

export const authApi = {
  login: (credentials: LoginRequest) =>
    wsClient.sendWsRequest<LoginResponse>('auth.login', credentials),
};
