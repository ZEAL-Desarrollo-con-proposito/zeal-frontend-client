import { describe, expect, it } from 'vitest';
import { createMockToken, readMockTokenSubject } from '../mockToken';
import { seedUser } from '@/test/credentials';
import {
  nextId,
  readWellbeingDb,
  SEED_PSYCHOLOGIST_ID,
  seedWellbeingDb,
  WELLBEING_DB_KEY,
} from './db';

const NOW = new Date(2026, 8, 23, 9, 20);

describe('simulador del Wellbeing Service', () => {
  it('siembra dos semanas laborales relativas a hoy', () => {
    const db = seedWellbeingDb(NOW);
    const own = db.slots.filter(({ psychologistId }) => psychologistId === SEED_PSYCHOLOGIST_ID);

    expect(own).toHaveLength(10 * 7);
    expect(own[0]?.id).toBe('franja-1');
    expect(db.slots.every((slot) => new Date(slot.startsAt).getDay() % 6 !== 0)).toBe(true);
  });

  it('siembra un directorio con un psicólogo en cada estado de disponibilidad', () => {
    const db = seedWellbeingDb(NOW);
    const freeOf = (id: string) =>
      db.slots.filter((slot) => slot.psychologistId === id && slot.status === 'DISPONIBLE');

    expect(db.psychologists.map(({ fullName }) => fullName)).toEqual([
      'Laura Martínez',
      'Andrés Rojas',
      'Valeria Castro',
      'Camila Duarte',
    ]);
    expect(freeOf('usr-psicologo-002').length).toBeGreaterThan(0);
    // Valeria tiene llena la semana actual y libre la siguiente; Camila no ha abierto bloques.
    expect(
      freeOf('usr-psicologo-003').every(
        ({ startsAt }) => new Date(startsAt) >= new Date(2026, 8, 28),
      ),
    ).toBe(true);
    expect(freeOf('usr-psicologo-004')).toEqual([]);
    const reservedSlots = db.slots.filter(({ status }) => status === 'RESERVADA');
    expect(
      reservedSlots.every(({ id }) => db.reservations.some(({ slotId }) => slotId === id)),
    ).toBe(true);
  });

  it('reserva la franja de la hora actual para el empleado semilla', () => {
    const db = seedWellbeingDb(NOW);
    const current = db.reservations.find(
      (reservation) => reservation.startsAt === new Date(2026, 8, 23, 9).toISOString(),
    );

    expect(current).toMatchObject({
      status: 'CONFIRMADA',
      employee: { fullName: 'David Cajamarca' },
    });
  });

  it('incluye reservas finalizadas y canceladas para el historial', () => {
    const statuses = new Set(seedWellbeingDb(NOW).reservations.map(({ status }) => status));

    expect(statuses).toEqual(new Set(['FINALIZADA', 'CONFIRMADA', 'CANCELADA']));
  });

  it('vuelve a sembrar si lo guardado está corrupto o incompleto', () => {
    localStorage.setItem(WELLBEING_DB_KEY, '{corrupto');
    expect(readWellbeingDb().slots.length).toBeGreaterThan(0);

    localStorage.setItem(WELLBEING_DB_KEY, JSON.stringify({ slots: [] }));
    expect(readWellbeingDb().reservations.length).toBeGreaterThan(0);

    // Una versión anterior del simulador (sin directorio) también se vuelve a sembrar.
    localStorage.setItem(
      WELLBEING_DB_KEY,
      JSON.stringify({ slots: [], reservations: [], sequence: 0 }),
    );
    expect(readWellbeingDb().psychologists.length).toBeGreaterThan(0);
  });

  it('nunca agenda dos citas confirmadas a la vez para el mismo empleado', () => {
    const confirmed = seedWellbeingDb(NOW).reservations.filter(
      ({ status }) => status === 'CONFIRMADA',
    );

    for (const reservation of confirmed) {
      const overlapping = confirmed.filter(
        (other) =>
          other.employee.id === reservation.employee.id &&
          Date.parse(other.startsAt) < Date.parse(reservation.endsAt) &&
          Date.parse(reservation.startsAt) < Date.parse(other.endsAt),
      );
      expect(overlapping).toHaveLength(1);
    }
  });

  it('genera identificadores únicos y crecientes', () => {
    const db = seedWellbeingDb(NOW);

    expect(nextId(db, 'franja')).not.toBe(nextId(db, 'franja'));
  });

  it('lee el sujeto de un token del simulador y descarta los ajenos', () => {
    expect(readMockTokenSubject(createMockToken(seedUser('ADMIN')))).toBe('usr-admin-001');
    expect(readMockTokenSubject('no.es-un-token')).toBeNull();
    expect(readMockTokenSubject('sin-segmentos')).toBeNull();
    expect(readMockTokenSubject(`x.${btoa('42')}.y`)).toBeNull();
  });
});
