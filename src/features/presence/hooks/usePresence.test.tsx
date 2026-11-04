import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { server } from '@/mocks/server';
import { configureHttpAuth } from '@/shared/api/httpClient';
import { RealtimeFactoryContext } from '@/shared/realtime/RealtimeContext';
import { RealtimeProvider } from '@/shared/realtime/RealtimeProvider';
import { buildSession } from '@/test/credentials';
import { scriptedRealtimeClient } from '@/test/realtime';
import { PRESENCE_ENDPOINT } from '../api/presenceApi';
import { presenceTopic } from '../model/presenceEvent';
import { usePresence } from './usePresence';

const PEER = 'usr-psicologo-001';
const OTRA = 'usr-psicologo-002';
const session = buildSession('EMPLEADO');

/** El servidor responde el estado que la prueba quiere, sea quien sea la persona preguntada. */
function presenciaDe(status: 'online' | 'offline'): void {
  server.use(
    http.get(`*${PRESENCE_ENDPOINT}/:id`, ({ params }) =>
      HttpResponse.json({ userId: String(params.id), status }),
    ),
  );
}

function renderPresence(userId = PEER) {
  const realtime = scriptedRealtimeClient();
  const view = renderHook(({ userId }: { userId: string }) => usePresence(userId), {
    initialProps: { userId },
    wrapper: ({ children }: { children: ReactNode }) => (
      <RealtimeFactoryContext value={() => realtime.client}>
        <RealtimeProvider accessToken={session.accessToken}>{children}</RealtimeProvider>
      </RealtimeFactoryContext>
    ),
  });
  return { ...view, realtime };
}

describe('usePresence', () => {
  beforeEach(() => {
    configureHttpAuth({
      accessToken: session.accessToken,
      renew: () => Promise.resolve(null),
    });
  });

  afterEach(() => {
    configureHttpAuth(null);
  });

  it('no dice nada hasta que el servidor responde', () => {
    presenciaDe('online');

    const { result } = renderPresence();

    expect(result.current).toBeNull();
  });

  it('entrega el estado con el que abre la consulta', async () => {
    presenciaDe('online');
    const { result } = renderPresence();

    await waitFor(() => {
      expect(result.current).toBe('online');
    });
  });

  it('cambia con el aviso del tiempo real sin volver a pedirlo', async () => {
    presenciaDe('offline');
    const { result, realtime } = renderPresence();
    await waitFor(() => {
      expect(result.current).toBe('offline');
    });

    act(() => {
      realtime.deliver(presenceTopic(PEER), { type: 'PRESENCIA', status: 'online' });
    });

    expect(result.current).toBe('online');
  });

  it('ignora lo que no es un aviso de presencia', async () => {
    presenciaDe('offline');
    const { result, realtime } = renderPresence();
    await waitFor(() => {
      expect(result.current).toBe('offline');
    });

    act(() => {
      realtime.deliver(presenceTopic(PEER), 'hola');
      realtime.deliver(presenceTopic(PEER), { type: 'NUEVO' });
      realtime.deliver(presenceTopic(PEER), { type: 'PRESENCIA', status: 'OCUPADA' });
    });

    expect(result.current).toBe('offline');
  });

  it('al reconectar vuelve a preguntar para no quedar desactualizado', async () => {
    presenciaDe('online');
    const { result, realtime } = renderPresence();
    await waitFor(() => {
      expect(result.current).toBe('online');
    });
    act(() => {
      realtime.deliver(presenceTopic(PEER), { type: 'PRESENCIA', status: 'offline' });
    });
    expect(result.current).toBe('offline');

    // El aviso en vivo llegó antes de caerse: ya no vale cuando la conexión se recupera.
    act(() => {
      realtime.store.set('reconnecting');
    });
    act(() => {
      realtime.store.set('connected');
    });

    await waitFor(() => {
      expect(result.current).toBe('online');
    });
  });

  it('descarta el aviso en vivo cuando cambia de persona, y manda el estado consultado', async () => {
    presenciaDe('online');
    const { result, realtime, rerender } = renderPresence();
    await waitFor(() => {
      expect(result.current).toBe('online');
    });
    act(() => {
      realtime.deliver(presenceTopic(PEER), { type: 'PRESENCIA', status: 'offline' });
    });
    expect(result.current).toBe('offline');

    rerender({ userId: OTRA });

    await waitFor(() => {
      expect(result.current).toBe('online');
    });
  });
});
