import type { Slot } from '@/features/availability/model/slot';
import { addDays, startOfWeek } from '@/shared/lib/dates';

/**
 * "Base de datos" del Wellbeing Service simulado. Vive en localStorage para que varias pestañas
 * (psicólogo y empleados) compartan el mismo estado durante una demo, como con el backend real.
 * Las reglas de negocio (solapes, reservas, ventanas de ingreso) se aplican en los handlers,
 * nunca en los componentes.
 */

export type ReservationStatus = 'CONFIRMADA' | 'CANCELADA' | 'FINALIZADA';

export interface ReservationRecord {
  id: string;
  slotId: string;
  psychologistId: string;
  employee: { id: string; fullName: string };
  startsAt: string;
  endsAt: string;
  status: ReservationStatus;
}

export interface WellbeingDb {
  slots: Slot[];
  reservations: ReservationRecord[];
  sequence: number;
}

export const WELLBEING_DB_KEY = 'zeal.mock.wellbeing';
export const SEED_PSYCHOLOGIST_ID = 'usr-psicologo-001';
export const SESSION_MINUTES = 50;

const SEED_HOURS = [8, 9, 10, 11, 14, 15, 16];
interface SeedEmployee {
  id: string;
  fullName: string;
}

const SEED_EMPLOYEES: readonly [SeedEmployee, ...SeedEmployee[]] = [
  { id: 'usr-empleado-001', fullName: 'David Cajamarca' },
  { id: 'usr-empleado-002', fullName: 'Mariana Torres' },
  { id: 'usr-empleado-003', fullName: 'Camilo Rincón' },
  { id: 'usr-empleado-004', fullName: 'Sofía Mejía' },
  { id: 'usr-empleado-005', fullName: 'Juan Pérez' },
  { id: 'usr-empleado-006', fullName: 'Valentina Arias' },
];

/** Elemento cíclico de una lista no vacía: el índice modular siempre está en rango. */
function cyclic<T>(items: readonly [T, ...T[]], index: number): T {
  return items[index % items.length] as T;
}

function atHour(day: Date, hour: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour);
}

function isCurrentHour(start: Date, now: Date): boolean {
  return start.getTime() <= now.getTime() && now.getTime() < start.getTime() + 60 * 60_000;
}

/** Dos semanas de jornada de la psicóloga semilla, relativas a `now` para que la demo siempre tenga datos. */
export function seedWellbeingDb(now: Date): WellbeingDb {
  const db: WellbeingDb = { slots: [], reservations: [], sequence: 0 };
  const monday = startOfWeek(now);

  for (let dayIndex = 0; dayIndex < 12; dayIndex += 1) {
    const day = addDays(monday, dayIndex);
    if (day.getDay() === 0 || day.getDay() === 6) {
      continue;
    }
    for (const hour of SEED_HOURS) {
      db.sequence += 1;
      const start = atHour(day, hour);
      const end = new Date(start.getTime() + SESSION_MINUTES * 60_000);
      // La franja de la hora actual siempre está reservada por el empleado semilla: permite probar
      // "Entrar a la sala" en cualquier demo durante la jornada.
      const reservedNow = isCurrentHour(start, now);
      const reserved = reservedNow || db.sequence % 3 === 0;
      const slot: Slot = {
        id: `franja-${db.sequence}`,
        psychologistId: SEED_PSYCHOLOGIST_ID,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        status: reserved ? 'RESERVADA' : 'DISPONIBLE',
      };
      db.slots.push(slot);

      if (reserved || db.sequence % 7 === 0) {
        const employee = cyclic(SEED_EMPLOYEES, reservedNow ? 0 : db.sequence);
        db.reservations.push({
          id: `reserva-${db.sequence}`,
          slotId: slot.id,
          psychologistId: SEED_PSYCHOLOGIST_ID,
          employee: { id: employee.id, fullName: employee.fullName },
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          status: reservationStatus(reserved, end, now),
        });
      }
    }
  }
  return db;
}

function reservationStatus(reserved: boolean, end: Date, now: Date): ReservationStatus {
  if (!reserved) {
    return 'CANCELADA'; // La franja quedó libre porque el empleado canceló.
  }
  return end.getTime() < now.getTime() ? 'FINALIZADA' : 'CONFIRMADA';
}

function isWellbeingDb(value: unknown): value is WellbeingDb {
  return (
    typeof value === 'object' &&
    value !== null &&
    'slots' in value &&
    Array.isArray(value.slots) &&
    'reservations' in value &&
    Array.isArray(value.reservations) &&
    'sequence' in value &&
    typeof value.sequence === 'number'
  );
}

export function readWellbeingDb(): WellbeingDb {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(WELLBEING_DB_KEY) ?? 'null');
    if (isWellbeingDb(stored)) {
      return stored;
    }
  } catch {
    // Datos corruptos: se vuelve a sembrar.
  }
  const seeded = seedWellbeingDb(new Date());
  writeWellbeingDb(seeded);
  return seeded;
}

export function writeWellbeingDb(db: WellbeingDb): void {
  localStorage.setItem(WELLBEING_DB_KEY, JSON.stringify(db));
}

/** Identificador nuevo y único dentro del simulador. */
export function nextId(db: WellbeingDb, prefix: string): string {
  db.sequence += 1;
  return `${prefix}-${db.sequence}`;
}
