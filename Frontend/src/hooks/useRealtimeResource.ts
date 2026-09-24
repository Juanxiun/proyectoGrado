import { useEffect } from 'react';
import { wsClient, type DataChangePayload } from '../api/websocket.client';

/**
 * Hook para suscribir un componente a cambios en tiempo real vía Webhooks / SignalR
 * del gateway de backend.
 */
export function useRealtimeResource(
  resource: string,
  onDataChanged: (payload: DataChangePayload) => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = wsClient.subscribeToDataChanges(resource, onDataChanged);
    return () => {
      unsubscribe();
    };
  }, [resource, onDataChanged, enabled]);
}
