const clients = new Set<WebSocket>();

export function addClient(socket: WebSocket): void {
  clients.add(socket);
  socket.addEventListener("close", () => clients.delete(socket));
  socket.addEventListener("error", () => clients.delete(socket));
}

export function broadcastUserEvent(event: {
  action: "created" | "updated" | "deleted";
  userId: string;
}): void {
  const payload = JSON.stringify({ type: "usuarios.changed", ...event });
  for (const socket of clients) {
    if (socket.readyState === WebSocket.OPEN) socket.send(payload);
    else clients.delete(socket);
  }
}
