import type { IMessage, StompConfig } from '@stomp/stompjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStompRealtimeClient, HEARTBEAT_MS, RECONNECT_DELAY_MS } from './stompRealtimeClient';

const stomp = vi.hoisted(() => {
  const created: FakeStompClient[] = [];

  class FakeStompClient {
    readonly config: StompConfig;
    active = false;
    connected = false;
    readonly handlers = new Map<string, (message: IMessage) => void>();
    readonly unsubscribed: string[] = [];
    readonly published: { destination: string; body: string }[] = [];
    readonly activate = vi.fn(() => {
      this.active = true;
    });
    readonly deactivate = vi.fn(() => {
      this.active = false;
      this.connected = false;
      return Promise.resolve();
    });

    constructor(config: StompConfig) {
      this.config = config;
      created.push(this);
    }

    subscribe(destination: string, handler: (message: IMessage) => void) {
      this.handlers.set(destination, handler);
      return {
        id: destination,
        unsubscribe: () => {
          this.unsubscribed.push(destination);
        },
      };
    }

    publish(frame: { destination: string; body: string }) {
      this.published.push(frame);
    }

    /** Simula que el broker aceptó la conexión (o la reconexión). */
    open() {
      this.connected = true;
      this.config.onConnect?.({} as never);
    }

    /** Simula la caída del socket. */
    drop() {
      this.connected = false;
      this.config.onWebSocketClose?.({});
    }

    deliver(destination: string, body: string) {
      this.handlers.get(destination)?.({ body } as IMessage);
    }
  }
  const SockJS = vi.fn(function FakeSockJS(this: { url: string }, url: string) {
    this.url = url;
  });
  return { FakeStompClient, SockJS, created };
});

vi.mock('@stomp/stompjs', () => ({ Client: stomp.FakeStompClient }));
vi.mock('sockjs-client', () => ({ default: stomp.SockJS }));

function fake() {
  const client = stomp.created.at(-1);
  if (client === undefined) {
    throw new Error('No se creó el cliente STOMP');
  }
  return client;
}

describe('createStompRealtimeClient', () => {
  beforeEach(() => {
    stomp.created.length = 0;
  });

  it('se conecta por SockJS con el token, heartbeats y reconexión automática', () => {
    const client = createStompRealtimeClient('https://rt.zeal.test/ws', 'token-abc');

    client.connect();

    const { config } = fake();
    expect(client.getStatus()).toBe('connecting');
    expect(fake().activate).toHaveBeenCalledOnce();
    expect(config.connectHeaders).toEqual({ Authorization: 'Bearer token-abc' });
    expect(config.reconnectDelay).toBe(RECONNECT_DELAY_MS);
    expect(config.heartbeatIncoming).toBe(HEARTBEAT_MS);
    expect(config.webSocketFactory?.()).toEqual({ url: 'https://rt.zeal.test/ws' });
  });

  it('entrega los mensajes JSON y descarta los que no lo son', () => {
    const client = createStompRealtimeClient('https://rt.zeal.test/ws', 't');
    const listener = vi.fn();
    client.subscribe('/topic/franjas', listener);
    client.connect();

    fake().open();
    fake().deliver('/topic/franjas', '{"type":"CREADA"}');
    fake().deliver('/topic/franjas', 'no-es-json');

    expect(client.getStatus()).toBe('connected');
    expect(listener).toHaveBeenCalledExactlyOnceWith({ type: 'CREADA' });
  });

  it('se suscribe de inmediato si ya está conectado y cancela en el broker al salir', () => {
    const client = createStompRealtimeClient('https://rt.zeal.test/ws', 't');
    client.connect();
    fake().open();

    const unsubscribe = client.subscribe('/topic/a', vi.fn());
    unsubscribe();

    expect(fake().unsubscribed).toEqual(['/topic/a']);
  });

  it('una suscripción cancelada antes de conectar nunca llega al broker', () => {
    const client = createStompRealtimeClient('https://rt.zeal.test/ws', 't');
    const unsubscribe = client.subscribe('/topic/a', vi.fn());

    unsubscribe();
    client.connect();
    fake().open();

    expect(fake().handlers.has('/topic/a')).toBe(false);
  });

  it('tras una caída reconecta, cuenta la recuperación y restaura las suscripciones', () => {
    const client = createStompRealtimeClient('https://rt.zeal.test/ws', 't');
    const listener = vi.fn();
    const onChange = vi.fn();
    client.onChange(onChange);
    const unsubscribe = client.subscribe('/topic/franjas', listener);
    client.connect();
    fake().open();

    fake().drop();
    expect(client.getStatus()).toBe('reconnecting');
    unsubscribe(); // Sin conexión no se avisa al broker: la suscripción ya murió con el socket.
    expect(fake().unsubscribed).toEqual([]);

    client.subscribe('/topic/franjas', listener);
    fake().open();
    fake().deliver('/topic/franjas', '1');

    expect(client.getStatus()).toBe('connected');
    expect(client.getRecoveries()).toBe(1);
    expect(listener).toHaveBeenCalledWith(1);
    expect(onChange).toHaveBeenCalled();
  });

  it('envía mensajes JSON al servidor solo con la conexión abierta', () => {
    const client = createStompRealtimeClient('https://rt.zeal.test/ws', 't');
    client.connect();

    client.publish('/app/salas/r-1/senales', { type: 'SALIO' });
    fake().open();
    client.publish('/app/salas/r-1/senales', { type: 'LISTO' });

    expect(fake().published).toEqual([
      { destination: '/app/salas/r-1/senales', body: '{"type":"LISTO"}' },
    ]);
  });

  it('al desconectarse queda inactivo y no reporta reconexión', () => {
    const client = createStompRealtimeClient('https://rt.zeal.test/ws', 't');
    client.connect();
    fake().open();

    client.disconnect();
    fake().drop();

    expect(fake().deactivate).toHaveBeenCalledOnce();
    expect(client.getStatus()).toBe('idle');
  });
});
