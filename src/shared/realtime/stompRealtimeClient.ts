import type { StompSubscription } from '@stomp/stompjs';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import type { RealtimeClient, RealtimeCredentials, RealtimeListener } from './realtimeClient';
import { createStatusStore } from './realtimeClient';

export const RECONNECT_DELAY_MS = 5_000;
export const HEARTBEAT_MS = 10_000;

interface Subscription {
  destination: string;
  listener: RealtimeListener;
}

function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

function parseBody(body: string): { ok: true; payload: unknown } | { ok: false } {
  try {
    return { ok: true, payload: JSON.parse(body) as unknown };
  } catch {
    return { ok: false }; // Mensaje que no es JSON: se ignora.
  }
}

/**
 * Adaptador del Real-Time Gateway: STOMP sobre SockJS con el token en la cabecera CONNECT,
 * reconexión automática y heartbeats. STOMP no conserva suscripciones entre conexiones, así que
 * se vuelven a crear en cada reconexión, con el token vigente en ese momento: el de la primera
 * conexión pudo vencer. Si el servidor rechaza la conexión, avisa a quien maneja la sesión.
 */
export function createStompRealtimeClient(
  url: string,
  accessToken: string,
  credentials?: RealtimeCredentials,
): RealtimeClient {
  const store = createStatusStore();
  const subscriptions = new Map<number, Subscription>();
  const handles = new Map<number, StompSubscription>();
  let nextId = 0;

  const client = new Client({
    webSocketFactory: () => new SockJS(url),
    connectHeaders: bearer(accessToken),
    beforeConnect: () => {
      client.connectHeaders = bearer(credentials?.currentToken() ?? accessToken);
    },
    onStompError: () => {
      credentials?.onRejected();
    },
    reconnectDelay: RECONNECT_DELAY_MS,
    heartbeatIncoming: HEARTBEAT_MS,
    heartbeatOutgoing: HEARTBEAT_MS,
    onConnect: () => {
      handles.clear();
      subscriptions.forEach((subscription, id) => {
        attach(id, subscription);
      });
      store.set('connected');
    },
    onWebSocketClose: () => {
      if (client.active) {
        store.set('reconnecting');
      }
    },
  });

  function attach(id: number, { destination, listener }: Subscription) {
    const handle = client.subscribe(destination, (message) => {
      const parsed = parseBody(message.body);
      if (parsed.ok) {
        listener(parsed.payload);
      }
    });
    handles.set(id, handle);
  }

  return {
    connect() {
      store.set('connecting');
      client.activate();
    },
    disconnect() {
      handles.clear();
      store.set('idle');
      void client.deactivate();
    },
    subscribe(destination, listener) {
      nextId += 1;
      const id = nextId;
      const subscription = { destination, listener };
      subscriptions.set(id, subscription);
      if (client.connected) {
        attach(id, subscription);
      }
      return () => {
        subscriptions.delete(id);
        const handle = handles.get(id);
        handles.delete(id);
        if (handle !== undefined && client.connected) {
          handle.unsubscribe();
        }
      };
    },
    publish(destination, payload) {
      if (client.connected) {
        client.publish({ destination, body: JSON.stringify(payload) });
      }
    },
    getStatus: store.getStatus,
    getRecoveries: store.getRecoveries,
    onChange: store.onChange,
  };
}
