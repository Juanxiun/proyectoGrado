import { API_BASE_URL } from "../constants/config";
import { storage } from "../utils/storage";

export class WebSocketClientError extends Error {
  constructor(
    message: string,
    public status: number = 500,
  ) {
    super(message);
    this.name = "WebSocketClientError";
  }
}

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timer: ReturnType<typeof setTimeout>;
}

export type DataChangePayload = {
  resource: string;
  method: string;
  timestamp: string;
};

export type EventCallback<T = any> = (data: T) => void;

class AppWebSocketClient {
  private ws: WebSocket | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private eventListeners: Map<string, Set<EventCallback>> = new Map();
  private isConnected = false;
  private connectionPromise: Promise<void> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private RECORD_SEP = "\x1e";

  private getWsUrl(): string {
    const httpUrl = API_BASE_URL || "http://localhost:5141";
    const wsBase = httpUrl.replace(/^http/, "ws");
    // El único punto WebSocket público es el Hub SignalR del gateway REST.
    // Los microservicios nunca se exponen directamente al cliente.
    return `${wsBase.replace(/\/$/, "")}/hub`;
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
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          // Handshake protocolo SignalR JSON
          this.ws?.send(
            JSON.stringify({ protocol: "json", version: 1 }) + this.RECORD_SEP,
          );
        };

        this.ws.onmessage = (event: MessageEvent) => {
          this.handleMessage(String(event.data), resolve, reject);
        };

        this.ws.onerror = (err) => {
          this.isConnected = false;
          this.connectionPromise = null;
          reject(
            new WebSocketClientError("Error en la conexión WebSocket", 503),
          );
        };

        this.ws.onclose = () => {
          this.isConnected = false;
          this.connectionPromise = null;
          this.scheduleReconnect();
        };
      } catch (err) {
        this.connectionPromise = null;
        reject(err);
      }
    });

    return this.connectionPromise;
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {});
    }, 4000);
  }

  private handleMessage(
    rawData: string,
    connectResolve: () => void,
    _connectReject: (err: any) => void,
  ) {
    const messages = rawData.split(this.RECORD_SEP).filter(Boolean);

    for (const msgStr of messages) {
      try {
        const msg = JSON.parse(msgStr);

        // Handshake inicial exitoso (recibe {})
        if (
          !this.isConnected &&
          (Object.keys(msg).length === 0 || msg.type === undefined)
        ) {
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
        if (msg.type === 1) {
          const target = msg.target;
          const args = msg.arguments || [];

          if (target === "ReceiveResponse") {
            const res = args[0];
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

          // Notificaciones de eventos tipo DataChanged, NotificacionNueva, etc.
          if (target) {
            const listeners = this.eventListeners.get(target);
            if (listeners) {
              listeners.forEach((cb) => {
                try {
                  cb(args[0]);
                } catch (err) {
                  console.error(`[WebSocketClient] Error en listener de ${target}:`, err);
                }
              });
            }
          }
        }
      } catch (e) {
        console.error("[WebSocketClient] Error parseando mensaje WS:", e);
      }
    }
  }

  /**
   * Suscribe una función callback a un evento de SignalR/Webhook (ej: DataChanged)
   */
  public on<T = any>(target: string, callback: EventCallback<T>): () => void {
    if (!this.eventListeners.has(target)) {
      this.eventListeners.set(target, new Set());
    }
    this.eventListeners.get(target)!.add(callback);
    this.connect().catch(() => {});

    // Retorna función para desuscribirse
    return () => {
      this.eventListeners.get(target)?.delete(callback);
    };
  }

  /**
   * Suscribe a cambios en tiempo real para un recurso específico (o '*' para todos)
   */
  public subscribeToDataChanges(
    resource: string,
    callback: (payload: DataChangePayload) => void,
  ): () => void {
    return this.on<DataChangePayload>("DataChanged", (payload) => {
      if (
        resource === "*" ||
        !payload?.resource ||
        payload.resource.toLowerCase() === resource.toLowerCase() ||
        payload.resource.toLowerCase().includes(resource.toLowerCase())
      ) {
        callback(payload);
      }
    });
  }

  public async sendWsRequest<T>(action: string, payload?: unknown): Promise<T> {
    await this.connect();

    const requestId = `req_${Date.now()}_${
      Math.random().toString(36).substring(2, 9)
    }`;

    // Adjuntar token de autenticación si existe
    const token = await storage.getToken();
    const fullPayload = {
      ...(payload && typeof payload === "object" ? payload : { data: payload }),
      authToken: token || undefined,
    };

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(
            new WebSocketClientError(
              "Tiempo de espera agotado (Timeout por WebSocket)",
              504,
            ),
          );
        }
      }, 20000);

      this.pendingRequests.set(requestId, { resolve, reject, timer });

      // SignalR invocation message: type 1, target "ExecuteAction", arguments [requestId, action, payload]
      const invocation = {
        type: 1,
        target: "ExecuteAction",
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
