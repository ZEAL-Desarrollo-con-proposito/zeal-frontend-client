import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Role } from '@/features/auth/model/session';
import { server } from '@/mocks/server';
import { ApiError, InvalidResponseError } from '@/shared/api/errors';
import { configureHttpAuth } from '@/shared/api/httpClient';
import { freezeTime } from '@/test/clock';
import { buildSession } from '@/test/credentials';
import { RESERVATIONS_ENDPOINT } from '@/features/agenda/api/agendaApi';
import { activateRoom, fetchRoom } from './roomApi';

// Miércoles 23 a las 9:20: reserva-16 (9:00, David con Laura) está en curso; reserva-18 es a las
// 11:00; reserva-15 (8:00) ya terminó; reserva-7 fue cancelada; reserva-107 es de otra psicóloga.
const at = (hour: number, minute = 0) => new Date(2026, 8, 23, hour, minute).toISOString();

function authenticateAs(role: Role) {
  configureHttpAuth({
    accessToken: buildSession(role).accessToken,
    onUnauthorized: () => undefined,
  });
}

async function failure(promise: Promise<unknown>): Promise<unknown> {
  return promise.catch((caught: unknown) => caught);
}

describe('roomApi (contrato con HU-BE-12)', () => {
  beforeEach(() => {
    freezeTime();
  });

  afterEach(() => {
    configureHttpAuth(null);
  });

  it('el psicólogo ve la sala con el paciente, la ventana de ingreso y los servidores ICE', async () => {
    authenticateAs('PSICOLOGO');

    await expect(fetchRoom('reserva-16')).resolves.toEqual({
      reservationId: 'reserva-16',
      status: 'PROGRAMADA',
      startsAt: at(9),
      endsAt: at(9, 50),
      opensAt: at(8, 50),
      closesAt: at(9, 50),
      participant: { id: 'usr-empleado-001', fullName: 'David Cajamarca' },
      iceServers: [],
    });
  });

  it('el empleado ve la misma sala con su psicóloga', async () => {
    authenticateAs('EMPLEADO');

    await expect(fetchRoom('reserva-16')).resolves.toMatchObject({
      participant: { id: 'usr-psicologo-001', fullName: 'Laura Martínez' },
    });
  });

  it('el estado lo decide el servidor: cancelada o finalizada no tiene videollamada', async () => {
    authenticateAs('PSICOLOGO');

    await expect(fetchRoom('reserva-7')).resolves.toMatchObject({ status: 'CANCELADA' });
    await expect(fetchRoom('reserva-15')).resolves.toMatchObject({ status: 'FINALIZADA' });
  });

  it('solo sus dos participantes la ven; el administrador nunca (HU-BE-11)', async () => {
    authenticateAs('EMPLEADO');
    await expect(failure(fetchRoom('reserva-107'))).resolves.toMatchObject({ status: 404 });
    await expect(failure(fetchRoom('reserva-999'))).resolves.toMatchObject({
      status: 404,
      serverMessage: 'Esta sesión no existe o no es tuya.',
    });

    authenticateAs('ADMIN');
    await expect(failure(fetchRoom('reserva-16'))).resolves.toMatchObject({ status: 403 });

    configureHttpAuth(null);
    await expect(failure(fetchRoom('reserva-16'))).resolves.toMatchObject({ status: 401 });
  });

  it('el psicólogo la activa dentro de la ventana, y activarla dos veces no falla', async () => {
    authenticateAs('PSICOLOGO');

    await expect(activateRoom('reserva-16')).resolves.toMatchObject({ status: 'ACTIVA' });
    await expect(activateRoom('reserva-16')).resolves.toMatchObject({ status: 'ACTIVA' });

    authenticateAs('EMPLEADO');
    await expect(fetchRoom('reserva-16')).resolves.toMatchObject({ status: 'ACTIVA' });
  });

  it.each([
    ['reserva-18', 'La sala abre a las 10:50.'],
    ['reserva-15', 'La sala de esta sesión ya cerró.'],
    ['reserva-7', 'Esta sesión fue cancelada.'],
  ])('rechaza activar %s: "%s"', async (id, message) => {
    authenticateAs('PSICOLOGO');

    const error = await failure(activateRoom(id));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, serverMessage: message });
  });

  it('solo el psicólogo de la sesión puede activarla', async () => {
    authenticateAs('PSICOLOGO');
    await expect(failure(activateRoom('reserva-107'))).resolves.toMatchObject({ status: 404 });

    authenticateAs('EMPLEADO');
    await expect(failure(activateRoom('reserva-16'))).resolves.toMatchObject({ status: 403 });
  });

  it('codifica la reserva en la ruta y valida la respuesta', async () => {
    let path = '';
    server.use(
      http.get(`*${RESERVATIONS_ENDPOINT}/:id/sala`, ({ request }) => {
        path = new URL(request.url).pathname;
        return HttpResponse.json({ reservationId: 'a/b' });
      }),
    );

    await expect(fetchRoom('a/b')).rejects.toBeInstanceOf(InvalidResponseError);
    expect(path).toBe('/api/wellbeing/reservas/a%2Fb/sala');
  });
});
