import { API_BASE_URL } from "../constants/config";

export function connectUsersWebSocket(onChange: () => void): () => void {
  let socket: WebSocket | null = null;
  const recordSeparator = "\x1e";
  const hubUrl = `${
    API_BASE_URL.replace(/^http/, "ws").replace(/\/$/, "")
  }/hub`;

  try {
    socket = new WebSocket(hubUrl);
    socket.onopen = () => {
      // Handshake requerido por SignalR cuando se usa WebSocket nativo.
      socket?.send(
        JSON.stringify({ protocol: "json", version: 1 }) + recordSeparator,
      );
    };
    socket.onmessage = (event) => {
      try {
        const frames = String(event.data).split(recordSeparator).filter(
          Boolean,
        );
        for (const frame of frames) {
          const message = JSON.parse(frame) as {
            type?: number;
            target?: string;
            arguments?: Array<{ resource?: string }>;
          };
          // Las pantallas de usuarios sólo se actualizan cuando el gateway
          // informa un cambio de ese recurso.
          if (
            message.type === 1 && message.target === "DataChanged" &&
            message.arguments?.[0]?.resource === "usuarios"
          ) {
            onChange();
          }
        }
      } catch {
        // La API HTTP continúa siendo la fuente de verdad.
      }
    };
  } catch {
    // No se bloquea la pantalla si el hub aún está iniciando.
  }

  return () => {
    socket?.close();
  };
}
