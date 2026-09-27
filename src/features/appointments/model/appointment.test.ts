import { describe, expect, it } from 'vitest';
import type { Appointment } from './appointment';
import {
  appointmentBadge,
  appointmentWhen,
  groupAppointments,
  isAppointment,
  timeUntil,
} from './appointment';

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

describe('groupAppointments', () => {
  const at = (day: number, hour: number) => new Date(2026, 8, day, hour).toISOString();
  const make = (id: string, day: number, status: Appointment['status']): Appointment => ({
    ...appointment,
    id,
    startsAt: at(day, 10),
    endsAt: at(day, 11),
    status,
  });

  it('separa próximas, historial y canceladas en el orden de cada pestaña', () => {
    const groups = groupAppointments([
      make('lejana', 30, 'CONFIRMADA'),
      make('vieja', 21, 'FINALIZADA'),
      make('cercana', 24, 'CONFIRMADA'),
      make('reciente', 22, 'FINALIZADA'),
      make('cancelada-1', 21, 'CANCELADA'),
      make('cancelada-2', 25, 'CANCELADA'),
    ]);

    expect(groups.upcoming.map(({ id }) => id)).toEqual(['cercana', 'lejana']);
    expect(groups.history.map(({ id }) => id)).toEqual(['reciente', 'vieja']);
    expect(groups.cancelled.map(({ id }) => id)).toEqual(['cancelada-2', 'cancelada-1']);
  });
});

describe('appointmentWhen', () => {
  const now = new Date(2026, 8, 23, 9, 20).getTime();
  const on = (day: number, hour: number): Appointment => ({
    ...appointment,
    startsAt: new Date(2026, 8, day, hour).toISOString(),
    endsAt: new Date(2026, 8, day, hour, 50).toISOString(),
  });

  it.each([
    [23, 10, 'Hoy · 10:00 – 10:50'],
    [24, 9, 'Mañana · 9:00 – 9:50'],
    [28, 8, 'Lun 28 · 8:00 – 8:50'],
    [21, 15, 'Lun 21 · 15:00 – 15:50'],
  ])('describe el día %i a las %i como "%s"', (day, hour, text) => {
    expect(appointmentWhen(on(day, hour), now)).toBe(text);
  });
});

describe('timeUntil', () => {
  const start = new Date(2026, 8, 23, 15);
  const session: Appointment = {
    ...appointment,
    startsAt: start.toISOString(),
    endsAt: new Date(2026, 8, 23, 15, 50).toISOString(),
  };
  const minutesBefore = (minutes: number) => start.getTime() - minutes * 60_000;

  it.each([
    ['en curso', new Date(2026, 8, 23, 15, 10).getTime(), 'En curso'],
    ['terminada', new Date(2026, 8, 23, 16).getTime(), 'Terminó'],
    ['a 25 minutos', minutesBefore(25), 'En 25 min'],
    ['a una hora', minutesBefore(60), 'En 1 hora'],
    ['a cinco horas y media', minutesBefore(330), 'En 5 horas'],
    ['mañana', new Date(2026, 8, 22, 9).getTime(), 'Mañana'],
    ['en cinco días', new Date(2026, 8, 18, 9).getTime(), 'En 5 días'],
  ])('dice cuánto falta para una cita %s', (_case, now, text) => {
    expect(timeUntil(session, now)).toBe(text);
  });
});

describe('appointmentBadge', () => {
  it.each([
    ['CONFIRMADA', 'Confirmada', 'sage'],
    ['FINALIZADA', 'Finalizada', 'neutral'],
    ['CANCELADA', 'Cancelada', 'coral'],
  ] as const)('muestra %s como "%s"', (status, label, tone) => {
    expect(appointmentBadge({ ...appointment, status })).toEqual({ label, tone });
  });
});
