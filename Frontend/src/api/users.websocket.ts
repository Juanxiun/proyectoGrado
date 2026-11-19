import { API_BASE_URL } from "../constants/config";

// connectUsersWebSocket -> refresca usuarios al cambiar el recurso
export function connectUsersWebSocket(onChange: () => void): () => void {
  let socket: WebSocket | null = null;
  const recordSeparator = "\x1e";
  const hubUrl = `${
    API_BASE_URL.replace(/^http/, "ws").replace(/\/$/, "")
  }/hub`;

  try {
    socket = new WebSocket(hubUrl);
    socket.onopen = () => {
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
          if (
            message.type === 1 && message.target === "DataChanged" &&
            message.arguments?.[0]?.resource === "usuarios"
          ) {
            onChange();
          }
        }
      } catch {
      }
    };
  } catch {
  }

  return () => {
    socket?.close();
  };
}
