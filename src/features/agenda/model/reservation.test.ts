import { describe, expect, it } from 'vitest';
import type { Reservation } from './reservation';
import {
  groupByDay,
  isInProgress,
  isReservation,
  joinState,
  nextSession,
  reservationBadge,
  summarize,
} from './reservation';

const at = (day: number, hour: number, minute = 0) => new Date(2026, 8, day, hour, minute);

function reservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 'reserva-1',
    employee: { id: 'usr-empleado-001', fullName: 'David Cajamarca' },
    startsAt: at(23, 10).toISOString(),
    endsAt: at(23, 10, 50).toISOString(),
    status: 'CONFIRMADA',
    joinOpensAt: at(23, 9, 50).toISOString(),
    joinClosesAt: at(23, 10, 50).toISOString(),
    ...overrides,
  };
}

describe('isReservation', () => {
  it('acepta una reserva bien formada, con o sin ventana de ingreso', () => {
    expect(isReservation(reservation())).toBe(true);
    expect(
      isReservation(reservation({ status: 'CANCELADA', joinOpensAt: null, joinClosesAt: null })),
    ).toBe(true);
  });

  it.each<[string, unknown]>([
    ['un valor que no es objeto', 'reserva'],
    ['un id no textual', { ...reservation(), id: 7 }],
    ['un empleado ausente', { ...reservation(), employee: null }],
    ['un empleado sin id', { ...reservation(), employee: { fullName: 'David' } }],
    ['un empleado sin nombre', { ...reservation(), employee: { id: 'usr' } }],
    ['un inicio que no es fecha', { ...reservation(), startsAt: 'mañana' }],
    ['un fin ausente', { ...reservation(), endsAt: undefined }],
    ['un estado desconocido', { ...reservation(), status: 'PENDIENTE' }],
    ['una apertura inválida', { ...reservation(), joinOpensAt: 'pronto' }],
    ['un cierre ausente', { ...reservation(), joinClosesAt: undefined }],
  ])('rechaza %s', (_case, value) => {
    expect(isReservation(value)).toBe(false);
  });
});

describe('joinState', () => {
  it('no ofrece la sala si el servidor no envió ventana de ingreso', () => {
    const cancelled = reservation({ status: 'CANCELADA', joinOpensAt: null });
    expect(joinState(cancelled, at(23, 10).getTime())).toEqual({ kind: 'unavailable' });
    const partial = reservation({ joinClosesAt: null });
    expect(joinState(partial, at(23, 10).getTime())).toEqual({ kind: 'unavailable' });
  });

  it('indica cuándo abre la sala antes de la ventana', () => {
    expect(joinState(reservation(), at(23, 9, 49).getTime())).toEqual({
      kind: 'upcoming',
      opensAt: at(23, 9, 50),
    });
  });

  it('abre la sala desde la apertura hasta el cierre, ambos incluidos', () => {
    const open = { kind: 'open', closesAt: at(23, 10, 50) };
    expect(joinState(reservation(), at(23, 9, 50).getTime())).toEqual(open);
    expect(joinState(reservation(), at(23, 10, 50).getTime())).toEqual(open);
  });

  it('cierra la sala cuando pasó la ventana', () => {
    expect(joinState(reservation(), at(23, 10, 51).getTime())).toEqual({ kind: 'closed' });
  });
});

describe('isInProgress y reservationBadge', () => {
  it('marca "En curso" una sesión confirmada mientras transcurre', () => {
    const during = at(23, 10, 10).getTime();
    expect(isInProgress(reservation(), during)).toBe(true);
    expect(reservationBadge(reservation(), during)).toEqual({ label: 'En curso', tone: 'teal' });
  });

  it('no marca "En curso" antes del inicio, al terminar ni si no está confirmada', () => {
    expect(isInProgress(reservation(), at(23, 9, 59).getTime())).toBe(false);
    expect(isInProgress(reservation(), at(23, 10, 50).getTime())).toBe(false);
    expect(isInProgress(reservation({ status: 'FINALIZADA' }), at(23, 10, 10).getTime())).toBe(
      false,
    );
  });

  it.each<[Reservation['status'], string, string]>([
    ['CONFIRMADA', 'Confirmada', 'sage'],
    ['CANCELADA', 'Cancelada', 'coral'],
    ['FINALIZADA', 'Finalizada', 'neutral'],
  ])('muestra el estado %s como "%s"', (status, label, tone) => {
    expect(reservationBadge(reservation({ status }), at(23, 8).getTime())).toEqual({ label, tone });
  });
});

describe('groupByDay', () => {
  it('agrupa por día y ordena por hora, aunque lleguen desordenadas', () => {
    const late = reservation({ id: 'tarde', startsAt: at(23, 16).toISOString() });
    const early = reservation({ id: 'temprano', startsAt: at(23, 8).toISOString() });
    const monday = reservation({ id: 'lunes', startsAt: at(21, 9).toISOString() });

    const days = groupByDay([late, monday, early]);

    expect(days.map(({ key }) => key)).toEqual(['2026-09-21', '2026-09-23']);
    expect(days[1]?.reservations.map(({ id }) => id)).toEqual(['temprano', 'tarde']);
    expect(days[0]?.day).toEqual(at(21, 9));
  });

  it('devuelve una lista vacía sin reservas', () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe('nextSession', () => {
  const cancelled = reservation({ id: 'cancelada', status: 'CANCELADA' });
  const inProgress = reservation({ id: 'en-curso' });
  const later = reservation({
    id: 'despues',
    startsAt: at(23, 14).toISOString(),
    endsAt: at(23, 14, 50).toISOString(),
  });

  it('elige la primera sesión confirmada que aún no termina, incluida la que está en curso', () => {
    expect(nextSession([later, cancelled, inProgress], at(23, 10, 20).getTime())?.id).toBe(
      'en-curso',
    );
    expect(nextSession([later, cancelled, inProgress], at(23, 10, 50).getTime())?.id).toBe(
      'despues',
    );
  });

  it('no devuelve nada cuando ya no quedan sesiones confirmadas', () => {
    expect(nextSession([later, cancelled], at(23, 15).getTime())).toBeNull();
  });
});

describe('summarize', () => {
  it('cuenta las sesiones en pie, las que faltan por atender y las canceladas', () => {
    expect(
      summarize([
        reservation({ status: 'FINALIZADA' }),
        reservation({ status: 'CONFIRMADA' }),
        reservation({ status: 'CONFIRMADA' }),
        reservation({ status: 'CANCELADA' }),
      ]),
    ).toEqual({ sessions: 3, confirmed: 2, cancelled: 1 });
  });
});
