import { describe, expect, it } from 'vitest';
import type { Appointment } from './appointment';
import { isAppointment } from './appointment';

const appointment: Appointment = {
  id: 'reserva-1',
  psychologist: { id: 'usr-psicologo-001', fullName: 'Laura Martínez', title: 'Psicóloga clínica' },
  startsAt: new Date(2026, 8, 23, 10).toISOString(),
  endsAt: new Date(2026, 8, 23, 10, 50).toISOString(),
  status: 'CONFIRMADA',
};

describe('isAppointment', () => {
  it('acepta una cita bien formada', () => {
    expect(isAppointment(appointment)).toBe(true);
  });

  it.each<[string, unknown]>([
    ['un valor que no es objeto', 'cita'],
    ['un id no textual', { ...appointment, id: 1 }],
    ['un psicólogo ausente', { ...appointment, psychologist: null }],
    ['un psicólogo sin id', { ...appointment, psychologist: { fullName: 'L', title: 'T' } }],
    ['un psicólogo sin nombre', { ...appointment, psychologist: { id: 'x', title: 'T' } }],
    ['un psicólogo sin título', { ...appointment, psychologist: { id: 'x', fullName: 'L' } }],
    ['un inicio inválido', { ...appointment, startsAt: 'mañana' }],
    ['un fin ausente', { ...appointment, endsAt: undefined }],
    ['un estado desconocido', { ...appointment, status: 'PENDIENTE' }],
  ])('rechaza %s', (_case, value) => {
    expect(isAppointment(value)).toBe(false);
  });
});
