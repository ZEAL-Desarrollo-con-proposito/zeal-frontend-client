import type { Workshop } from '@/features/workshops/model/workshop';
import type { WorkshopSpotsEvent } from '@/features/workshops/model/workshopEvent';
import { workshopTopic } from '@/features/workshops/model/workshopEvent';
import { addDays, startOfDay } from '@/shared/lib/dates';
import { publishMockEvent } from '../realtime';
import { OTHER_ORGANIZATION, SEED_ORGANIZATION } from '../seedUsers';

/** Taller guardado: de qué empresa es (HU-BE-18). */
export interface WorkshopRecord extends Workshop {
  organization: string;
}

/** Inscripción guardada: de quién es y a qué taller. */
export interface EnrollmentRecord {
  id: string;
  workshopId: string;
  userId: string;
  createdAt: string;
  version: number;
}

/**
 * "Base de datos" de talleres simulada (HU-BE-18), en localStorage para que varias pestañas
 * compartan los mismos cupos e inscripciones, como con el backend real. Cupos e inscripciones se
 * guardan juntos: tomar un cupo es una sola escritura.
 */
export interface WorkshopsDb {
  workshops: WorkshopRecord[];
  enrollments: EnrollmentRecord[];
  sequence: number;
}

export const WORKSHOPS_DB_KEY = 'zeal.mock.talleres';

const MINUTE_MS = 60_000;
const HALF_HOUR_MS = 30 * MINUTE_MS;

interface SeedWorkshop {
  id: string;
  title: string;
  summary: string;
  facilitator: string;
  capacity: number;
  occupied: number;
  startsAt: Date;
  minutes: number;
  organization?: string;
}

function toRecord({ startsAt, minutes, organization, ...workshop }: SeedWorkshop): WorkshopRecord {
  return {
    ...workshop,
    organization: organization ?? SEED_ORGANIZATION,
    version: 1,
    startsAt: startsAt.toISOString(),
    endsAt: new Date(startsAt.getTime() + minutes * MINUTE_MS).toISOString(),
  };
}

/** Talleres del Figma B6, con horarios relativos a `now`: el destacado empieza en 45 minutos. */
export function seedWorkshopsDb(now: Date): WorkshopsDb {
  const inMinutes = (minutes: number) => new Date(now.getTime() + minutes * MINUTE_MS);
  const laterToday = new Date(Math.ceil(inMinutes(180).getTime() / HALF_HOUR_MS) * HALF_HOUR_MS);
  const dayAt = (days: number, hours: number, minutes = 0) => {
    const day = addDays(startOfDay(now), days);
    day.setHours(hours, minutes);
    return day;
  };
  const seeds: SeedWorkshop[] = [
    {
      id: 'taller-malestar-agil',
      title: 'Gestión del malestar en equipos ágiles',
      summary: 'Cómo nombrar la sobrecarga sin quedar como “el que no aguanta”.',
      facilitator: 'Gabriela Muñoz',
      capacity: 30,
      occupied: 12,
      startsAt: inMinutes(45),
      minutes: 50,
    },
    {
      id: 'taller-limites-sanos',
      title: 'Límites sanos y desconexión digital',
      summary: 'Acuerdos de equipo para dejar de responder mensajes a medianoche.',
      facilitator: 'Diego Guzmán',
      capacity: 30,
      occupied: 30,
      startsAt: laterToday,
      minutes: 60,
    },
    {
      id: 'taller-impostor',
      title: 'Síndrome del impostor en tu primer empleo',
      summary: 'Herramientas para separar lo que sientes de lo que de verdad aportas.',
      facilitator: 'Andrés Rojas',
      capacity: 30,
      occupied: 29,
      startsAt: dayAt(1, 12, 30),
      minutes: 60,
    },
    {
      id: 'taller-descanso-real',
      title: 'Descanso real: dormir en semana de release',
      summary: 'Higiene del sueño para las semanas de entrega más exigentes.',
      facilitator: 'Julián Mora',
      capacity: 25,
      occupied: 8,
      startsAt: dayAt(5, 7),
      minutes: 45,
    },
    {
      id: 'taller-conversaciones-dificiles',
      title: 'Conversaciones difíciles con tu líder',
      summary: 'Cómo pedir ayuda, poner límites o dar una mala noticia sin romper la confianza.',
      facilitator: 'Laura Martínez',
      capacity: 30,
      occupied: 17,
      startsAt: dayAt(6, 16),
      minutes: 60,
    },
    {
      id: 'taller-mentoria-inversa',
      title: 'Mentoría inversa: enseñarle a tu jefe',
      summary: 'Compartir tus herramientas con quien lleva más años sin sentir que lo corriges.',
      facilitator: 'Sara Peña',
      capacity: 25,
      occupied: 22,
      startsAt: dayAt(7, 11),
      minutes: 50,
    },
    {
      id: 'taller-primeros-auxilios',
      title: 'Primeros auxilios psicológicos para equipos',
      summary: 'Qué hacer, y qué no, cuando alguien de tu equipo está pasando un mal momento.',
      facilitator: 'Valeria Castro',
      capacity: 20,
      occupied: 5,
      startsAt: dayAt(8, 15),
      minutes: 90,
    },
    {
      id: 'taller-en-curso',
      title: 'Pausas activas para el cuerpo y la mente',
      summary: 'Ya empezó: no se lista ni recibe inscripciones.',
      facilitator: 'Gabriela Muñoz',
      capacity: 20,
      occupied: 9,
      startsAt: inMinutes(-20),
      minutes: 60,
    },
    {
      id: 'taller-otra-empresa',
      title: 'Taller de otra empresa',
      summary: 'Pertenece a otra organización y nunca debe verse aquí.',
      facilitator: 'Diego Guzmán',
      capacity: 10,
      occupied: 0,
      startsAt: dayAt(2, 10),
      minutes: 60,
      organization: OTHER_ORGANIZATION,
    },
  ];
  return { enrollments: [], sequence: 0, workshops: seeds.map(toRecord) };
}

function isWorkshopsDb(value: unknown): value is WorkshopsDb {
  return (
    typeof value === 'object' &&
    value !== null &&
    'workshops' in value &&
    Array.isArray(value.workshops) &&
    'enrollments' in value &&
    Array.isArray(value.enrollments) &&
    'sequence' in value &&
    typeof value.sequence === 'number'
  );
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

export function writeWorkshopsDb(db: WorkshopsDb): void {
  localStorage.setItem(WORKSHOPS_DB_KEY, JSON.stringify(db));
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
