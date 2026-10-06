import { isRecord } from '@/features/auth/model/session';
import type { Workshop } from '@/features/workshops/model/workshop';
import { isWorkshop } from '@/features/workshops/model/workshop';
import type { WorkshopSpotsEvent } from '@/features/workshops/model/workshopEvent';
import { workshopTopic } from '@/features/workshops/model/workshopEvent';
import { addDays, startOfDay } from '@/shared/lib/dates';
import { publishMockEvent } from '../realtime';
import { OTHER_ORGANIZATION, SEED_ORGANIZATION } from '../seedUsers';

/** Taller guardado: de qué empresa es (HU-BE-15). */
export interface WorkshopRecord extends Workshop {
  organization: string;
}

/** Inscripción guardada: de quién es y a qué taller (HU-BE-18). */
export interface EnrollmentRecord {
  id: string;
  workshopId: string;
  userId: string;
  createdAt: string;
  version: number;
}

/**
 * "Base de datos" de talleres simulada (HU-BE-15 y 18), en localStorage para que varias pestañas
 * compartan los mismos talleres, cupos e inscripciones, como con el backend real. Cupos e
 * inscripciones se guardan juntos: tomar un cupo es una sola escritura.
 */
export interface WorkshopsDb {
  workshops: WorkshopRecord[];
  enrollments: EnrollmentRecord[];
  sequence: number;
}

export const WORKSHOPS_DB_KEY = 'zeal.mock.talleres';

const MINUTE_MS = 60_000;
const HALF_HOUR_MS = 30 * MINUTE_MS;

/**
 * El taller del administrador semilla (el más reciente) y los del Figma B6, con fechas relativas
 * a `now`: el próximo empieza en 45 minutos, uno ya está lleno y otro ya empezó.
 */
export function seedWorkshopsDb(now: Date): WorkshopsDb {
  const inMinutes = (minutes: number) => new Date(now.getTime() + minutes * MINUTE_MS);
  const laterToday = new Date(Math.ceil(inMinutes(180).getTime() / HALF_HOUR_MS) * HALF_HOUR_MS);
  const dayAt = (days: number, hours: number, minutes = 0) => {
    const day = addDays(startOfDay(now), days);
    day.setHours(hours, minutes);
    return day;
  };
  const publishedAgo = (days: number) => addDays(now, -days).toISOString();
  const workshop = (
    fields: Omit<WorkshopRecord, 'organization' | 'startsAt' | 'version'>,
    startsAt: Date,
    organization = SEED_ORGANIZATION,
  ): WorkshopRecord => ({ ...fields, organization, startsAt: startsAt.toISOString(), version: 1 });

  return {
    enrollments: [],
    sequence: 0,
    workshops: [
      workshop(
        {
          id: 'taller-pausas-activas',
          publishedAt: publishedAgo(2),
          title: 'Pausas activas y respiración',
          description: 'Aprende técnicas breves de respiración y pausas activas para tu jornada.',
          durationMinutes: 60,
          capacity: 30,
          occupied: 12,
        },
        dayAt(7, 15),
      ),
      workshop(
        {
          id: 'taller-malestar-agil',
          publishedAt: publishedAgo(3),
          title: 'Gestión del malestar en equipos ágiles',
          description:
            'Cómo nombrar la sobrecarga sin quedar como “el que no aguanta”. Facilita Gabriela Muñoz, psicóloga organizacional.',
          durationMinutes: 50,
          capacity: 30,
          occupied: 12,
        },
        inMinutes(45),
      ),
      workshop(
        {
          id: 'taller-limites-sanos',
          publishedAt: publishedAgo(4),
          title: 'Límites sanos y desconexión digital',
          description: 'Acuerdos de equipo para dejar de responder mensajes a medianoche.',
          durationMinutes: 60,
          capacity: 30,
          occupied: 30,
        },
        laterToday,
      ),
      workshop(
        {
          id: 'taller-impostor',
          publishedAt: publishedAgo(5),
          title: 'Síndrome del impostor en tu primer empleo',
          description: 'Herramientas para separar lo que sientes de lo que de verdad aportas.',
          durationMinutes: 60,
          capacity: 30,
          occupied: 29,
        },
        dayAt(1, 12, 30),
      ),
      workshop(
        {
          id: 'taller-descanso-real',
          publishedAt: publishedAgo(6),
          title: 'Descanso real: dormir en semana de release',
          description: 'Higiene del sueño para las semanas de entrega más exigentes.',
          durationMinutes: 45,
          capacity: 25,
          occupied: 8,
        },
        dayAt(5, 7),
      ),
      workshop(
        {
          id: 'taller-conversaciones-dificiles',
          publishedAt: publishedAgo(7),
          title: 'Conversaciones difíciles con tu líder',
          description:
            'Cómo pedir ayuda, poner límites o dar una mala noticia sin romper la confianza.',
          durationMinutes: 60,
          capacity: 30,
          occupied: 17,
        },
        dayAt(6, 16),
      ),
      workshop(
        {
          id: 'taller-mentoria-inversa',
          publishedAt: publishedAgo(8),
          title: 'Mentoría inversa: enseñarle a tu jefe',
          description:
            'Compartir tus herramientas con quien lleva más años sin sentir que lo corriges.',
          durationMinutes: 50,
          capacity: 25,
          occupied: 22,
        },
        dayAt(7, 11),
      ),
      workshop(
        {
          id: 'taller-primeros-auxilios',
          publishedAt: publishedAgo(9),
          title: 'Primeros auxilios psicológicos para equipos',
          description:
            'Qué hacer, y qué no, cuando alguien de tu equipo está pasando un mal momento.',
          durationMinutes: 90,
          capacity: 20,
          occupied: 5,
        },
        dayAt(8, 15),
      ),
      workshop(
        {
          id: 'taller-yoga-escritorio',
          publishedAt: publishedAgo(10),
          title: 'Yoga de escritorio',
          description: 'Estiramientos para hacer sin levantarte de tu puesto de trabajo.',
          durationMinutes: 60,
          capacity: 20,
          occupied: 9,
        },
        inMinutes(-20),
      ),
      workshop(
        {
          id: 'taller-otra-empresa',
          publishedAt: publishedAgo(1),
          title: 'Taller de otra empresa',
          description: 'Pertenece a otra organización y nunca debe verse aquí.',
          durationMinutes: 60,
          capacity: 10,
          occupied: 0,
        },
        dayAt(2, 10),
        OTHER_ORGANIZATION,
      ),
    ],
  };
}

function isWorkshopsDb(value: unknown): value is WorkshopsDb {
  return (
    isRecord(value) &&
    typeof value.sequence === 'number' &&
    Array.isArray(value.enrollments) &&
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

/** Lo que viaja al cliente: el taller sin la empresa a la que pertenece. */
export function toWorkshop(record: WorkshopRecord): Workshop {
  const {
    id,
    title,
    description,
    startsAt,
    durationMinutes,
    capacity,
    occupied,
    version,
    publishedAt,
  } = record;
  return {
    id,
    title,
    description,
    startsAt,
    durationMinutes,
    capacity,
    occupied,
    version,
    publishedAt,
  };
}

/** Avisa por el canal del taller sus cupos actuales. */
export function publishWorkshopSpots(workshop: Workshop): WorkshopSpotsEvent {
  const event: WorkshopSpotsEvent = {
    type: 'CUPOS',
    workshopId: workshop.id,
    capacity: workshop.capacity,
    occupied: workshop.occupied,
    version: workshop.version,
  };
  publishMockEvent(workshopTopic(workshop.id), event);
  return event;
}

/**
 * Cambia los cupos ocupados de un taller y lo avisa por su canal, como el servidor cuando otra
 * persona se inscribe o libera su cupo. Cada cambio sube la versión.
 */
export function updateWorkshopOccupied(workshopId: string, occupied: number): WorkshopSpotsEvent {
  const db = readWorkshopsDb();
  const workshop = db.workshops.find(({ id }) => id === workshopId);
  if (workshop === undefined) {
    throw new Error(`No existe el taller ${workshopId}`);
  }
  workshop.occupied = Math.min(Math.max(occupied, 0), workshop.capacity);
  workshop.version += 1;
  writeWorkshopsDb(db);
  return publishWorkshopSpots(workshop);
}
