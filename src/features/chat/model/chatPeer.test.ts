import { describe, expect, it } from 'vitest';
import type { Reservation } from '@/features/agenda/model/reservation';
import type { Appointment } from '@/features/appointments/model/appointment';
import { employeePeer, psychologistPeer } from './chatPeer';

const NOW = new Date(2026, 8, 23, 9, 20).getTime();
const MINUTE = 60_000;

function cita(id: string, fullName: string, startsAt: Date): Appointment {
  return {
    id: `cita-${id}`,
    psychologist: { id, fullName, title: 'Psicóloga clínica' },
    startsAt: startsAt.toISOString(),
    endsAt: new Date(startsAt.getTime() + 50 * MINUTE).toISOString(),
    status: 'CONFIRMADA',
  };
}

function reserva(id: string, fullName: string, startsAt: Date): Reservation {
  return {
    id: `reserva-${id}`,
    employee: { id, fullName },
    startsAt: startsAt.toISOString(),
    endsAt: new Date(startsAt.getTime() + 50 * MINUTE).toISOString(),
    status: 'CONFIRMADA',
    joinOpensAt: null,
    joinClosesAt: null,
  };
}

describe('psychologistPeer', () => {
  it('sin citas no hay con quién hablar', () => {
    expect(psychologistPeer([], NOW)).toBeNull();
  });

  it('habla con el de la cita más próxima, aunque ya esté en curso', () => {
    const enCurso = cita('usr-psicologo-001', 'Laura Martínez', new Date(2026, 8, 23, 9));
    const deManana = cita('usr-psicologo-002', 'Andrés Rojas', new Date(2026, 8, 24, 14));
    const cancelada = cita('usr-psicologo-003', 'Valeria Castro', new Date(2026, 8, 23, 8));

    const peer = psychologistPeer([deManana, cancelada, enCurso], NOW);

    expect(peer).toEqual({
      id: 'usr-psicologo-001',
      fullName: 'Laura Martínez',
      title: 'Psicóloga clínica',
    });
  });

  it('si todas las citas ya pasaron, conversa con el de la más reciente', () => {
    const anteayer = cita('usr-psicologo-003', 'Valeria Castro', new Date(2026, 8, 21, 15));
    const ayer = cita('usr-psicologo-002', 'Andrés Rojas', new Date(2026, 8, 22, 11));

    expect(psychologistPeer([anteayer, ayer], NOW)).toEqual({
      id: 'usr-psicologo-002',
      fullName: 'Andrés Rojas',
      title: 'Psicóloga clínica',
    });
  });
});

describe('employeePeer', () => {
  it('sin reservas no hay con quién hablar', () => {
    expect(employeePeer([], NOW)).toBeNull();
  });

  it('habla con el de la reserva más próxima', () => {
    const manana = reserva('usr-empleado-003', 'Camilo Rincón', new Date(2026, 8, 24, 10));
    const enCurso = reserva('usr-empleado-001', 'David Cajamarca', new Date(2026, 8, 23, 9));

    expect(employeePeer([manana, enCurso], NOW)).toEqual({
      id: 'usr-empleado-001',
      fullName: 'David Cajamarca',
    });
  });

  it('si todas las reservas ya pasaron, conversa con el de la más reciente', () => {
    const antigua = reserva('usr-empleado-004', 'Sofía Mejía', new Date(2026, 8, 18, 10));
    const reciente = reserva('usr-empleado-005', 'Juan Pérez', new Date(2026, 8, 22, 16));

    expect(employeePeer([antigua, reciente], NOW)).toEqual({
      id: 'usr-empleado-005',
      fullName: 'Juan Pérez',
    });
  });
});
