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

/** Perfil público de un psicólogo en el directorio (HU-04). */
export interface PsychologistRecord {
  id: string;
  fullName: string;
  title: string;
  focusAreas: string[];
}

export interface WellbeingDb {
  psychologists: PsychologistRecord[];
  slots: Slot[];
  reservations: ReservationRecord[];
  sequence: number;
}

export const WELLBEING_DB_KEY = 'zeal.mock.wellbeing';
export const SEED_PSYCHOLOGIST_ID = 'usr-psicologo-001';
export const SESSION_MINUTES = 50;

const SEED_HOURS = [8, 9, 10, 11, 14, 15, 16];

const SEED_PSYCHOLOGISTS: readonly PsychologistRecord[] = [
  {
    id: SEED_PSYCHOLOGIST_ID,
    fullName: 'Laura Martínez',
    title: 'Psicóloga clínica',
    focusAreas: ['Ansiedad laboral', 'Burnout'],
  },
  {
    id: 'usr-psicologo-002',
    fullName: 'Andrés Rojas',
    title: 'Psicólogo organizacional',
    focusAreas: ['Carrera', 'Burnout'],
  },
  {
    id: 'usr-psicologo-003',
    fullName: 'Valeria Castro',
    title: 'Psicóloga clínica',
    focusAreas: ['Duelo', 'Ansiedad laboral'],
  },
  {
    id: 'usr-psicologo-004',
    fullName: 'Camila Duarte',
    title: 'Psicóloga de la salud',
    focusAreas: ['Sueño', 'Ansiedad laboral'],
  },
];

/**
 * Agendas del resto del directorio, para que la demo muestre cada estado: Andrés tiene bloques
 * libres hoy, Valeria tiene la semana llena y Camila aún no abre bloques.
 */
interface SeedSchedule {
  psychologistId: string;
  hours: readonly number[];
  isReserved: (weekIndex: number, hour: number) => boolean;
}

const OTHER_SCHEDULES: readonly SeedSchedule[] = [
  {
    psychologistId: 'usr-psicologo-002',
    hours: [8, 13, 17],
    isReserved: (week, hour) => week === 0 && hour === 8,
  },
  { psychologistId: 'usr-psicologo-003', hours: [9, 11, 15], isReserved: (week) => week === 0 },
];

const SEED_DAYS = 12;
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

/** Días laborales de las dos semanas semilla, con su semana (0 = la actual). */
function seedWorkdays(now: Date): { day: Date; weekIndex: number }[] {
  const monday = startOfWeek(now);
  return Array.from({ length: SEED_DAYS }, (_, dayIndex) => ({
    day: addDays(monday, dayIndex),
    weekIndex: Math.floor(dayIndex / 7),
  })).filter(({ day }) => day.getDay() !== 0 && day.getDay() !== 6);
}

/** Crea una franja (y su reserva, si la tiene) con el siguiente id del simulador. */
function seedSlot(
  db: WellbeingDb,
  now: Date,
  psychologistId: string,
  start: Date,
  booking: { reserved: boolean; cancelled: boolean; employee: SeedEmployee },
): void {
  db.sequence += 1;
  const end = new Date(start.getTime() + SESSION_MINUTES * 60_000);
  const slot: Slot = {
    id: `franja-${String(db.sequence)}`,
    psychologistId,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    status: booking.reserved ? 'RESERVADA' : 'DISPONIBLE',
  };
  db.slots.push(slot);
  if (booking.reserved || booking.cancelled) {
    db.reservations.push({
      id: `reserva-${String(db.sequence)}`,
      slotId: slot.id,
      psychologistId,
      employee: { id: booking.employee.id, fullName: booking.employee.fullName },
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      status: reservationStatus(booking.reserved, end, now),
    });
  }
}

/** Dos semanas de jornada del directorio, relativas a `now` para que la demo siempre tenga datos. */
export function seedWellbeingDb(now: Date): WellbeingDb {
  const db: WellbeingDb = {
    psychologists: SEED_PSYCHOLOGISTS.map((psychologist) => ({
      ...psychologist,
      focusAreas: [...psychologist.focusAreas],
    })),
    slots: [],
    reservations: [],
    sequence: 0,
  };
  const workdays = seedWorkdays(now);

  // La psicóloga semilla va primero: sus ids (franja-1…franja-70) no cambian entre versiones.
  for (const { day } of workdays) {
    for (const hour of SEED_HOURS) {
      const start = atHour(day, hour);
      const sequence = db.sequence + 1;
      // La franja de la hora actual siempre está reservada por el empleado semilla: permite probar
      // "Entrar a la sala" en cualquier demo durante la jornada.
      const reservedNow = isCurrentHour(start, now);
      seedSlot(db, now, SEED_PSYCHOLOGIST_ID, start, {
        reserved: reservedNow || sequence % 3 === 0,
        cancelled: sequence % 7 === 0,
        employee: cyclic(SEED_EMPLOYEES, reservedNow ? 0 : sequence),
      });
    }
  }

  for (const schedule of OTHER_SCHEDULES) {
    for (const { day, weekIndex } of workdays) {
      for (const hour of schedule.hours) {
        seedSlot(db, now, schedule.psychologistId, atHour(day, hour), {
          reserved: schedule.isReserved(weekIndex, hour),
          cancelled: false,
          // Nunca el empleado semilla: sus citas (con Laura) no deben cruzarse con estas.
          employee: cyclic(SEED_EMPLOYEES, 1 + (db.sequence % (SEED_EMPLOYEES.length - 1))),
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
    'psychologists' in value &&
    Array.isArray(value.psychologists) &&
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
