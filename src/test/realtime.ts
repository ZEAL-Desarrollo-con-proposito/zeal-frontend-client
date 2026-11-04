import { waitFor } from '@testing-library/react';
import { expect } from 'vitest';
import type {
  RealtimeClient,
  RealtimeClientFactory,
  RealtimeListener,
} from '@/shared/realtime/realtimeClient';
import { createStatusStore } from '@/shared/realtime/realtimeClient';

/**
 * Anota a qué destinos está suscrita la pantalla, con cualquier cliente que cree la fábrica.
 * React suscribe en un efecto, que puede correr justo después de que el contenido aparece (con la
 * CPU ocupada, incluso después de que llega un aviso): `subscribedTo` espera la suscripción antes
 * de publicar, para que el aviso no se pierda.
 */
export function trackSubscriptions(factory: RealtimeClientFactory) {
  const active = new Map<string, number>();
  const count = (destination: string) => active.get(destination) ?? 0;

  const tracked: RealtimeClientFactory = (accessToken, credentials) => {
    const client = factory(accessToken, credentials);
    return {
      ...client,
      subscribe: (destination, listener) => {
        active.set(destination, count(destination) + 1);
        const unsubscribe = client.subscribe(destination, listener);
        return () => {
          active.set(destination, count(destination) - 1);
          unsubscribe();
        };
      },
    };
  };

  async function subscribedTo(destination: string): Promise<void> {
    await waitFor(() => {
      expect(count(destination)).toBeGreaterThan(0);
    });
  }

  return { factory: tracked, subscribedTo };
}

/**
 * Cliente de tiempo real que la prueba controla con `store.set(...)`: decide cuándo se cae y
 * cuándo se recupera. No entrega mensajes, como una conexión caída.
 */
export function controlledRealtimeClient() {
  const store = createStatusStore();
  const client: RealtimeClient = {
    connect: () => {
      store.set('connected');
    },
    disconnect: () => {
      store.set('idle');
    },
    subscribe: () => () => undefined,
    publish: () => undefined,
    getStatus: store.getStatus,
    getRecoveries: store.getRecoveries,
    onChange: store.onChange,
  };
  return { client, store };
}

interface PublishedFrame {
  destination: string;
  payload: unknown;
}

/**
 * Cliente de tiempo real dirigido por la prueba: `deliver(...)` hace llegar a la vez lo que el
 * servidor manda (sin esperar al canal entre pestañas), `published` guarda lo que la pantalla
 * envía y `store.set(...)` simula que la conexión se cae y se recupera. Antes de entregar, la
 * prueba espera la suscripción con `subscribedTo` de `renderRoute`.
 */
export function scriptedRealtimeClient() {
  const store = createStatusStore();
  const subscriptions = new Map<number, { destination: string; listener: RealtimeListener }>();
  const published: PublishedFrame[] = [];
  let nextId = 0;

  const client: RealtimeClient = {
    connect: () => {
      store.set('connected');
    },
    disconnect: () => {
      store.set('idle');
    },
    subscribe: (destination, listener) => {
      nextId += 1;
      const id = nextId;
      subscriptions.set(id, { destination, listener });
      return () => {
        subscriptions.delete(id);
      };
    },
    publish: (destination, payload) => {
      published.push({ destination, payload });
    },
    getStatus: store.getStatus,
    getRecoveries: store.getRecoveries,
    onChange: store.onChange,
  };

  function deliver(destination: string, payload: unknown): void {
    subscriptions.forEach(({ destination: suscripto, listener }) => {
      if (suscripto === destination) {
        listener(payload);
      }
    });
  }

  return { client, store, deliver, published };
}
