import { act, renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { server } from '@/mocks/server';
import { configureHttpAuth } from '@/shared/api/httpClient';
import { freezeTime } from '@/test/clock';
import { buildSession } from '@/test/credentials';
import { claimEndpoint } from '../api/freedSlotsApi';
import { useFreedSlots } from './useFreedSlots';

describe('useFreedSlots.claim', () => {
  beforeEach(() => {
    freezeTime();
    configureHttpAuth({
      accessToken: buildSession('EMPLEADO').accessToken,
      onUnauthorized: () => undefined,
    });
  });

  afterEach(() => {
    configureHttpAuth(null);
  });

  it('dos clics seguidos, antes de que React vuelva a pintar, envían una sola petición', async () => {
    let requests = 0;
    server.use(
      http.post(`*${claimEndpoint('cupo-1')}`, () => {
        requests += 1;
        return HttpResponse.json({ status: 409, error: 'Conflict' }, { status: 409 });
      }),
    );
    const { result } = renderHook(() => useFreedSlots());

    await act(async () => {
      await Promise.all([result.current.claim('cupo-1'), result.current.claim('cupo-1')]);
    });

    expect(requests).toBe(1);
  });
});
