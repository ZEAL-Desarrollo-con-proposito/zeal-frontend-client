import { act, renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RESERVATIONS_ENDPOINT } from '@/features/agenda/api/agendaApi';
import { server } from '@/mocks/server';
import { readWellbeingDb } from '@/mocks/wellbeing/db';
import { configureHttpAuth } from '@/shared/api/httpClient';
import { freezeTime } from '@/test/clock';
import { buildSession } from '@/test/credentials';
import type { Appointment } from '../model/appointment';
import { useCancelAppointment } from './useCancelAppointment';

const MARGIN_24H = 25 * 60 * 60 * 1000;

/** Path de cancelación con comodín para el origen, alineado con el código de producción. */
function cancelPathFor(id: string): string {
  return `*${RESERVATIONS_ENDPOINT}/${encodeURIComponent(id)}/cancelar`;
}

const baseAppointment: Appointment = {
  id: 'reserva-base',
  psychologist: { id: 'usr-psicologo-001', fullName: 'Laura Martínez', title: 'Psicóloga clínica' },
  startsAt: new Date(2026, 8, 23, 10).toISOString(),
  endsAt: new Date(2026, 8, 23, 10, 50).toISOString(),
  status: 'CONFIRMADA',
};

function authenticateAsEmployee() {
  configureHttpAuth({
    accessToken: buildSession('EMPLEADO').accessToken,
    onUnauthorized: () => undefined,
  });
}

function findCancelableReservation() {
  const db = readWellbeingDb();
  const now = Date.now();
  const reservation = db.reservations.find(
    (r) =>
      r.employee.id === 'usr-empleado-001' &&
      r.status === 'CONFIRMADA' &&
      Date.parse(r.startsAt) - now > MARGIN_24H,
  );
  if (reservation === undefined) {
    throw new Error('No hay cita cancelable (>24 h) en la semilla');
  }
  return reservation;
}

function buildTarget(): Appointment {
  const reservation = findCancelableReservation();
  return {
    ...baseAppointment,
    id: reservation.id,
    startsAt: reservation.startsAt,
    endsAt: reservation.endsAt,
  };
}

describe('useCancelAppointment', () => {
  beforeEach(() => {
    freezeTime();
    authenticateAsEmployee();
  });

  afterEach(() => {
    configureHttpAuth(null);
    vi.restoreAllMocks();
  });

  it('abre y cierra el diálogo de confirmación sin cancelar nada', () => {
    const target = buildTarget();
    const onCancelled = vi.fn();
    const { result } = renderHook(() => useCancelAppointment({ onCancelled }));

    expect(result.current.target).toBeNull();

    act(() => {
      result.current.request(target);
    });
    expect(result.current.target).toEqual(target);

    act(() => {
      result.current.cancel();
    });
    expect(result.current.target).toBeNull();
    expect(onCancelled).not.toHaveBeenCalled();
  });

  it('al confirmar, llama a la API, notifica la cita cancelada y cierra el diálogo', async () => {
    const target = buildTarget();
    const onCancelled = vi.fn();
    const { result } = renderHook(() => useCancelAppointment({ onCancelled }));

    await act(async () => {
      await result.current.confirm(target);
    });

    expect(onCancelled).toHaveBeenCalledTimes(1);
    expect(onCancelled).toHaveBeenCalledWith(
      expect.objectContaining({ id: target.id, status: 'CANCELADA' }),
    );
    expect(result.current.target).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isPending).toBe(false);
  });

  it('si la cita ya no existe (404), la da por cancelada de forma idempotente', async () => {
    const target = buildTarget();

    server.use(http.post(cancelPathFor(target.id), () => new HttpResponse(null, { status: 404 })));

    const onCancelled = vi.fn();
    const { result } = renderHook(() => useCancelAppointment({ onCancelled }));

    await act(async () => {
      await result.current.confirm(target);
    });

    expect(onCancelled).toHaveBeenCalledWith({ ...target, status: 'CANCELADA' });
    expect(result.current.error).toBeNull();
    expect(result.current.target).toBeNull();
  });

  it('si el servidor rechaza con 409, muestra el mensaje y conserva el diálogo abierto', async () => {
    const target = buildTarget();

    server.use(
      http.post(cancelPathFor(target.id), () =>
        HttpResponse.json({ message: 'La cita ya empezó' }, { status: 409 }),
      ),
    );

    const onCancelled = vi.fn();
    const { result } = renderHook(() => useCancelAppointment({ onCancelled }));

    act(() => {
      result.current.request(target);
    });

    await act(async () => {
      await result.current.confirm(target);
    });

    expect(onCancelled).not.toHaveBeenCalled();
    expect(result.current.error).not.toBeNull();
    expect(result.current.target).toEqual(target);
    expect(result.current.isPending).toBe(false);
  });

  it('si falla la red, deja reintentar y limpia el error al reintentar', async () => {
    const target = buildTarget();

    server.use(http.post(cancelPathFor(target.id), () => HttpResponse.error()));

    const onCancelled = vi.fn();
    const { result } = renderHook(() => useCancelAppointment({ onCancelled }));

    act(() => {
      result.current.request(target);
    });

    await act(async () => {
      await result.current.confirm(target);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.target).toEqual(target);
  });

  it('marca isPending mientras la petición está en curso', async () => {
    const target = buildTarget();

    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post(cancelPathFor(target.id), async () => {
        await gate;
        return HttpResponse.json({ ...target, status: 'CANCELADA' });
      }),
    );

    const onCancelled = vi.fn();
    const { result } = renderHook(() => useCancelAppointment({ onCancelled }));

    let promise!: Promise<void>;
    act(() => {
      promise = result.current.confirm(target);
    });

    expect(result.current.isPending).toBe(true);
    expect(result.current.target).toBeNull();

    await act(async () => {
      release();
      await promise;
    });

    expect(result.current.isPending).toBe(false);
  });
});
