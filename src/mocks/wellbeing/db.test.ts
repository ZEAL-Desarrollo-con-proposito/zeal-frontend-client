import { describe, expect, it } from 'vitest';
import { createMockToken, readMockTokenSubject } from '../mockToken';
import { seedUser } from '@/test/credentials';
import { nextId, readWellbeingDb, seedWellbeingDb, WELLBEING_DB_KEY } from './db';

const NOW = new Date(2026, 8, 23, 9, 20);

describe('simulador del Wellbeing Service', () => {
  it('siembra dos semanas laborales relativas a hoy', () => {
    const db = seedWellbeingDb(NOW);

    expect(db.slots).toHaveLength(10 * 7);
    expect(db.slots.every((slot) => new Date(slot.startsAt).getDay() % 6 !== 0)).toBe(true);
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
