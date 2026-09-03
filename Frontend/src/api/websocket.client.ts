import { API_BASE_URL } from '../constants/config';
import { storage } from '../utils/storage';

export class WebSocketClientError extends Error {
  constructor(
    message: string,
    public status: number = 500,
  ) {
    super(message);
    this.name = 'WebSocketClientError';
  }
}

interface PendingRequest {
  // deno-lint-ignore no-explicit-any
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timer: ReturnType<typeof setTimeout>;
}

class AppWebSocketClient {
  private ws: WebSocket | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private isConnected = false;
  private connectionPromise: Promise<void> | null = null;
  private RECORD_SEP = '\x1e';

  private getWsUrl(): string {
    const httpUrl = API_BASE_URL || 'http://localhost:5000';
    const wsBase = httpUrl.replace(/^http/, 'ws');
    return `${wsBase.replace(/\/$/, '')}/hub/app`;
  }

  public async connect(): Promise<void> {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      return;
    }
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        const url = this.getWsUrl();
        console.log(`[WebSocketClient] Conectando a ${url}...`);
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('[WebSocketClient] Conexión establecida. Iniciando Handshake SignalR...');
          // Handshake protocolo SignalR JSON
          this.ws?.send(JSON.stringify({ protocol: 'json', version: 1 }) + this.RECORD_SEP);
        };

        this.ws.onmessage = (event: MessageEvent) => {
          this.handleMessage(String(event.data), resolve, reject);
        };

        this.ws.onerror = (err) => {
          console.error('[WebSocketClient] Error de WebSocket:', err);
          this.isConnected = false;
          this.connectionPromise = null;
          reject(new WebSocketClientError('Error en la conexión WebSocket', 503));
        };

        this.ws.onclose = () => {
          console.log('[WebSocketClient] Conexión WebSocket cerrada.');
          this.isConnected = false;
          this.connectionPromise = null;
        };
      } catch (err) {
        this.connectionPromise = null;
        reject(err);
      }
    });

    return this.connectionPromise;
  }

  private handleMessage(rawData: string, connectResolve: () => void, _connectReject: (err: any) => void) {
    const messages = rawData.split(this.RECORD_SEP).filter(Boolean);

    for (const msgStr of messages) {
      try {
        const msg = JSON.parse(msgStr);

        // Handshake inicial exitoso (recibe {})
        if (!this.isConnected && (Object.keys(msg).length === 0 || msg.type === undefined)) {
          console.log('[WebSocketClient] Handshake SignalR completado exitosamente.');
          this.isConnected = true;
          connectResolve();
          continue;
        }

        // Ping de SignalR
        if (msg.type === 6) {
          this.ws?.send(JSON.stringify({ type: 6 }) + this.RECORD_SEP);
          continue;
        }

        // Invocación devuelta desde el Servidor (type === 1)
        if (msg.type === 1 && msg.target === 'ReceiveResponse') {
          const res = msg.arguments?.[0];
          if (res && res.requestId) {
            const pending = this.pendingRequests.get(res.requestId);
            if (pending) {
              clearTimeout(pending.timer);
              this.pendingRequests.delete(res.requestId);

              if (res.status >= 200 && res.status < 300) {
                pending.resolve(res.data);
              } else {
                pending.reject(
                  new WebSocketClientError(
                    res.error || `Error en WebSocket (${res.status})`,
                    res.status,
                  ),
                );
              }
            }
          }
        }
      } catch (e) {
        console.error('[WebSocketClient] Error parseando mensaje WS:', e);
      }
    }
  }

  public async sendWsRequest<T>(action: string, payload?: unknown): Promise<T> {
    await this.connect();

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Adjuntar token de autenticación si existe
    const token = await storage.getToken();
    const fullPayload = {
      ...(payload && typeof payload === 'object' ? payload : { data: payload }),
      authToken: token || undefined,
    };

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new WebSocketClientError('Tiempo de espera agotado (Timeout por WebSocket)', 504));
        }
      }, 20000);

      this.pendingRequests.set(requestId, { resolve, reject, timer });

      // SignalR invocation message: type 1, target "ExecuteAction", arguments [requestId, action, payload]
      const invocation = {
        type: 1,
        target: 'ExecuteAction',
        arguments: [requestId, action, fullPayload],
      };

      try {
        this.ws?.send(JSON.stringify(invocation) + this.RECORD_SEP);
      } catch (err) {
        clearTimeout(timer);
        this.pendingRequests.delete(requestId);
        reject(err);
      }
    });
  }
}

export const wsClient = new AppWebSocketClient();
