import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createMockRealtimeClient, publishMockEvent } from '@/mocks/realtime';
import { DEFAULT_REALTIME_URL, resolveRealtimeUrl } from '@/shared/config/realtimeUrl';
import type { RealtimeClient } from './realtimeClient';
import { createStatusStore } from './realtimeClient';
import { RealtimeFactoryContext } from './RealtimeContext';
import { RealtimeProvider } from './RealtimeProvider';
import { useRealtimeStatus, useRealtimeSubscription } from './useRealtime';

/** Cliente controlable: la prueba decide cuándo conecta, se cae o se recupera. */
function controllableClient() {
  const store = createStatusStore();
  const listeners = new Map<string, (payload: unknown) => void>();
  const client: RealtimeClient = {
    connect: vi.fn(() => {
      store.set('connecting');
    }),
    disconnect: vi.fn(() => {
      store.set('idle');
    }),
    subscribe: vi.fn((destination: string, listener: (payload: unknown) => void) => {
      listeners.set(destination, listener);
      return () => listeners.delete(destination);
    }),
    getStatus: store.getStatus,
    getRecoveries: store.getRecoveries,
    onChange: store.onChange,
  };
  return { client, store, listeners };
}

function wrapperWith(
  accessToken: string | null,
  factory: ((token: string) => RealtimeClient) | null,
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RealtimeFactoryContext value={factory}>
        <RealtimeProvider accessToken={accessToken}>{children}</RealtimeProvider>
      </RealtimeFactoryContext>
    );
  };
}

describe('estado de conexión', () => {
  it('cuenta como recuperación cada conexión después de la primera', () => {
    const store = createStatusStore();
    const listener = vi.fn();
    const stop = store.onChange(listener);

    store.set('connected');
    store.set('reconnecting');
    store.set('connected');
    stop();
    store.set('idle');

    expect(store.getRecoveries()).toBe(1);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('usa el Real-Time Gateway local si no hay URL configurada', () => {
    expect(resolveRealtimeUrl(undefined)).toBe(DEFAULT_REALTIME_URL);
    expect(resolveRealtimeUrl(' ')).toBe(DEFAULT_REALTIME_URL);
    expect(resolveRealtimeUrl('https://rt.zeal.co/ws')).toBe('https://rt.zeal.co/ws');
  });
});

describe('RealtimeProvider', () => {
  it('sin sesión o sin adaptador no conecta y reporta inactividad', () => {
    const factory = vi.fn();
    const { result } = renderHook(() => useRealtimeStatus(), {
      wrapper: wrapperWith(null, factory),
    });
    renderHook(() => useRealtimeStatus(), { wrapper: wrapperWith('token', null) });

    expect(result.current).toEqual({ status: 'idle', recoveries: 0 });
    expect(factory).not.toHaveBeenCalled();
  });

  it('abre una conexión por sesión, refleja su estado y la cierra al salir', () => {
    const { client, store } = controllableClient();
    const factory = vi.fn(() => client);
    const { result, unmount } = renderHook(() => useRealtimeStatus(), {
      wrapper: wrapperWith('token-1', factory),
    });

    expect(factory).toHaveBeenCalledWith('token-1');
    expect(result.current.status).toBe('connecting');
    act(() => {
      store.set('connected');
      store.set('reconnecting');
      store.set('connected');
    });
    expect(result.current).toEqual({ status: 'connected', recoveries: 1 });

    unmount();
    expect(client.disconnect).toHaveBeenCalled();
  });

  it('entrega los mensajes al callback más reciente y cancela al desmontar', () => {
    const { client, listeners } = controllableClient();
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ listener }) => {
        useRealtimeSubscription('/topic/x', listener);
      },
      { wrapper: wrapperWith('token', () => client), initialProps: { listener: first } },
    );

    rerender({ listener: second });
    listeners.get('/topic/x')?.('hola');
    unmount();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('hola');
    expect(listeners.has('/topic/x')).toBe(false);
  });

  it('sin conexión no se suscribe', () => {
    const listener = vi.fn();

    renderHook(
      () => {
        useRealtimeSubscription('/topic/x', listener);
      },
      { wrapper: wrapperWith(null, () => controllableClient().client) },
    );

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('tiempo real simulado', () => {
  it('entrega por destino entre "pestañas" y deja de hacerlo al desconectar', async () => {
    const client = createMockRealtimeClient();
    const franjas = vi.fn();
    const otros = vi.fn();
    client.subscribe('/topic/franjas', franjas);
    const stop = client.subscribe('/topic/otros', otros);
    client.connect();

    stop();
    publishMockEvent('/topic/franjas', { type: 'CREADA' });
    publishMockEvent('/topic/otros', 1);

    await waitFor(() => {
      expect(franjas).toHaveBeenCalledWith({ type: 'CREADA' });
    });
    expect(otros).not.toHaveBeenCalled();
    expect(client.getStatus()).toBe('connected');

    client.disconnect();
    client.disconnect();
    expect(client.getStatus()).toBe('idle');
  });
});
