import { USER_SERVICE_WS_URL } from '../constants/config';
import { storage } from '../utils/storage';

export function connectUsersWebSocket(onChange: () => void): () => void {
  const tokenPromise = storage.getToken();
  let socket: WebSocket | null = null;
  let cancelled = false;

  tokenPromise.then((token) => {
    if (cancelled || !token) return;
    socket = new WebSocket(`${USER_SERVICE_WS_URL}/ws?token=${encodeURIComponent(token)}`);
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string) as { type?: string };
        if (message.type === 'usuarios.changed') onChange();
      } catch {
        // Ignore malformed events; the HTTP API remains the source of truth.
      }
    };
  });

  return () => {
    cancelled = true;
    socket?.close();
  };
}
