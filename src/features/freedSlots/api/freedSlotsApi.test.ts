import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { server } from '@/mocks/server';
import { ApiError, InvalidResponseError } from '@/shared/api/errors';
import { configureHttpAuth } from '@/shared/api/httpClient';
import { freezeTime } from '@/test/clock';
import { buildSession } from '@/test/credentials';
import { claimEndpoint, claimFreedSlot, FREED_SLOTS_ENDPOINT } from './freedSlotsApi';

const APPOINTMENT = {
  id: 'reserva-90',
  psychologist: { id: 'usr-psicologo-001', fullName: 'Laura Martínez', title: 'Psicóloga clínica' },
  startsAt: new Date(2026, 8, 24, 8).toISOString(),
  endsAt: new Date(2026, 8, 24, 8, 50).toISOString(),
  status: 'CONFIRMADA',
};

describe('freedSlotsApi.claimFreedSlot', () => {
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

  it('pide tomar el cupo por su ruta, con el id codificado', () => {
    expect(FREED_SLOTS_ENDPOINT).toBe('/api/wellbeing/cupos');
    expect(claimEndpoint('cupo 1/a')).toBe('/api/wellbeing/cupos/cupo%201%2Fa/tomar');
  });

  it('entrega la cita que ganó', async () => {
    let method = '';
    server.use(
      http.post(`*${claimEndpoint('cupo-1')}`, ({ request }) => {
        method = request.method;
        return HttpResponse.json(APPOINTMENT);
      }),
    );

    await expect(claimFreedSlot('cupo-1')).resolves.toEqual(APPOINTMENT);
    expect(method).toBe('POST');
  });

  it('rechaza una respuesta que no es una cita', async () => {
    server.use(http.post(`*${claimEndpoint('cupo-1')}`, () => HttpResponse.json({ ok: true })));

    await expect(claimFreedSlot('cupo-1')).rejects.toBeInstanceOf(InvalidResponseError);
  });

  it('conserva el estado y el mensaje del servidor cuando otra persona lo tomó primero', async () => {
    server.use(
      http.post(`*${claimEndpoint('cupo-1')}`, () =>
        HttpResponse.json(
          { status: 409, error: 'Conflict', message: 'Otra persona tomó este cupo antes que tú.' },
          { status: 409 },
        ),
      ),
    );

    await expect(claimFreedSlot('cupo-1')).rejects.toMatchObject({
      status: 409,
      serverMessage: 'Otra persona tomó este cupo antes que tú.',
    });
    await expect(claimFreedSlot('cupo-1')).rejects.toBeInstanceOf(ApiError);
  });
});
