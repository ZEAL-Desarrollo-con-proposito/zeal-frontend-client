import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureHttpAuth } from '@/shared/api/httpClient';
import { RealtimeFactoryContext } from '@/shared/realtime/RealtimeContext';
import { RealtimeProvider } from '@/shared/realtime/RealtimeProvider';
import { freezeTime } from '@/test/clock';
import { buildSession } from '@/test/credentials';
import { scriptedRealtimeClient } from '@/test/realtime';
import { keepOnlyAdminSeedWorkshop } from '@/test/workshops';
import type { Workshop } from '../model/workshop';
import { WORKSHOPS_QUEUE } from '../model/workshopEvent';
import { useAdminWorkshops } from './useAdminWorkshops';

describe('useAdminWorkshops', () => {
  let realtime: ReturnType<typeof scriptedRealtimeClient>;

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <RealtimeFactoryContext value={() => realtime.client}>
        <RealtimeProvider accessToken={buildSession('ADMIN').accessToken}>
          {children}
        </RealtimeProvider>
      </RealtimeFactoryContext>
    );
  }

  beforeEach(() => {
    freezeTime();
    keepOnlyAdminSeedWorkshop();
    realtime = scriptedRealtimeClient();
    configureHttpAuth({
      accessToken: buildSession('ADMIN').accessToken,
      renew: () => Promise.resolve(null),
    });
  });

  afterEach(() => {
    configureHttpAuth(null);
  });

  it('lista los talleres sin opciones y queda listo', async () => {
    const { result } = renderHook(() => useAdminWorkshops(), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(result.current.workshops.map(({ id }) => id)).toEqual(['taller-pausas-activas']);

    act(() => {
      result.current.retry();
    });
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(result.current.workshops).toHaveLength(1);
  });

  it('anuncia solo lo que publicó otra sesión, una sola vez', async () => {
    const onRemotePublished = vi.fn();
    const { result } = renderHook(() => useAdminWorkshops({ onRemotePublished }), { wrapper });
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    const [seed] = result.current.workshops;
    if (seed === undefined) {
      throw new Error('Falta el taller semilla en la lista');
    }

    // El eco de lo que esta organización ya conoce no es noticia.
    act(() => {
      realtime.deliver(WORKSHOPS_QUEUE, { type: 'PUBLICADO', workshop: seed });
    });
    expect(onRemotePublished).not.toHaveBeenCalled();
    expect(result.current.workshops).toHaveLength(1);

    const remote: Workshop = {
      ...seed,
      id: 'taller-remoto',
      title: 'Taller publicado por otra sesión',
      publishedAt: new Date(2026, 8, 23, 10).toISOString(),
    };
    act(() => {
      realtime.deliver(WORKSHOPS_QUEUE, { type: 'PUBLICADO', workshop: remote });
    });
    expect(onRemotePublished).toHaveBeenCalledTimes(1);
    expect(onRemotePublished).toHaveBeenCalledWith(remote);
    expect(result.current.workshops.map(({ id }) => id)).toEqual([
      'taller-remoto',
      'taller-pausas-activas',
    ]);

    // Repetir el mismo aviso no duplica ni vuelve a avisar.
    act(() => {
      realtime.deliver(WORKSHOPS_QUEUE, { type: 'PUBLICADO', workshop: remote });
    });
    expect(onRemotePublished).toHaveBeenCalledTimes(1);
    expect(result.current.workshops).toHaveLength(2);

    // Mensajes que no son de talleres se ignoran.
    act(() => {
      realtime.deliver(WORKSHOPS_QUEUE, { type: 'OTRO', workshop: remote });
    });
    expect(onRemotePublished).toHaveBeenCalledTimes(1);
    expect(result.current.workshops).toHaveLength(2);
  });
});
