import { isRecord } from '@/features/auth/model/session';
import type { Workshop } from '@/features/workshops/model/workshop';
import { isWorkshop } from '@/features/workshops/model/workshop';
import { addDays } from '@/shared/lib/dates';
import { SEED_ORGANIZATION } from '../projects/db';

/** Taller guardado: de qué empresa es (HU-BE-15). */
export interface WorkshopRecord extends Workshop {
  organization: string;
}

/**
 * "Base de datos" de talleres simulada (HU-BE-15), en localStorage para que varias pestañas
 * compartan los mismos talleres, como con el backend real.
 */
export interface WorkshopsDb {
  workshops: WorkshopRecord[];
  sequence: number;
}

export const WORKSHOPS_DB_KEY = 'zeal.mock.talleres';

/** Un taller de ejemplo para la empresa semilla, con fechas relativas a `now`. */
export function seedWorkshopsDb(now: Date): WorkshopsDb {
  const startsAt = addDays(now, 7);
  startsAt.setHours(15, 0, 0, 0);
  return {
    sequence: 0,
    workshops: [
      {
        id: 'taller-pausas-activas',
        organization: SEED_ORGANIZATION,
        publishedAt: addDays(now, -2).toISOString(),
        title: 'Pausas activas y respiración',
        description: 'Aprende técnicas breves de respiración y pausas activas para tu jornada.',
        startsAt: startsAt.toISOString(),
        durationMinutes: 60,
        capacity: 30,
        occupied: 12,
        version: 1,
      },
    ],
  };
}

function isWorkshopsDb(value: unknown): value is WorkshopsDb {
  return (
    isRecord(value) &&
    typeof value.sequence === 'number' &&
    Array.isArray(value.workshops) &&
    value.workshops.every(
      (workshop) =>
        isWorkshop(workshop) && isRecord(workshop) && typeof workshop.organization === 'string',
    )
  );
}

export function writeWorkshopsDb(db: WorkshopsDb): void {
  localStorage.setItem(WORKSHOPS_DB_KEY, JSON.stringify(db));
}

export function readWorkshopsDb(): WorkshopsDb {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(WORKSHOPS_DB_KEY) ?? 'null');
    if (isWorkshopsDb(stored)) {
      return stored;
    }
  } catch {
    // Datos corruptos: se vuelve a sembrar.
  }
  const seeded = seedWorkshopsDb(new Date());
  writeWorkshopsDb(seeded);
  return seeded;
}
