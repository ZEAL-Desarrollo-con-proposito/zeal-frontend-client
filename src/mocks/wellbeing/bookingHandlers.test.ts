import { describe, expect, it } from 'vitest';
import { toAppointment } from './bookingHandlers';
import type { PsychologistRecord, ReservationRecord } from './db';

const psychologist: PsychologistRecord = {
  id: 'usr-psicologo-001',
  fullName: 'Laura Martínez',
  title: 'Psicóloga clínica',
  focusAreas: [],
};

const record: ReservationRecord = {
  id: 'reserva-1',
  slotId: 'franja-1',
  psychologistId: psychologist.id,
  employee: { id: 'usr-empleado-001', fullName: 'David Cajamarca' },
  startsAt: new Date(2026, 8, 23, 10).toISOString(),
  endsAt: new Date(2026, 8, 23, 10, 50).toISOString(),
  status: 'CONFIRMADA',
};

describe('toAppointment (regla del simulador)', () => {
  it('muestra la cita al empleado con los datos públicos del psicólogo', () => {
    expect(toAppointment(record, psychologist, new Date(2026, 8, 23, 9).getTime())).toEqual({
      id: 'reserva-1',
      psychologist: { id: psychologist.id, fullName: 'Laura Martínez', title: 'Psicóloga clínica' },
      startsAt: record.startsAt,
      endsAt: record.endsAt,
      status: 'CONFIRMADA',
    });
  });

  it('finaliza una cita confirmada que ya terminó y respeta las canceladas', () => {
    const later = new Date(2026, 8, 23, 11).getTime();

    expect(toAppointment(record, psychologist, later).status).toBe('FINALIZADA');
    expect(toAppointment({ ...record, status: 'CANCELADA' }, psychologist, later).status).toBe(
      'CANCELADA',
    );
  });
});
