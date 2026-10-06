import type { ApplicationStatus } from '@/features/projects/model/application';
import type { ProjectDetail } from '@/features/projects/model/project';
import type { SpotsEvent } from '@/features/projects/model/spotsEvent';
import { projectTopic } from '@/features/projects/model/spotsEvent';
import { addDays } from '@/shared/lib/dates';
import { publishMockEvent } from '../realtime';
import { OTHER_ORGANIZATION, SEED_ORGANIZATION } from '../seedUsers';

/** Postulación guardada: de quién es y qué resultado le asignó el servidor (HU-BE-17). */
export interface ApplicationRecord {
  id: string;
  projectId: string;
  userId: string;
  status: ApplicationStatus;
  waitlistPosition: number | null;
  createdAt: string;
  version: number;
}

/** Convocatoria guardada: de qué empresa es y cuándo se publicó (HU-BE-14). */
export interface ProjectRecord extends ProjectDetail {
  organization: string;
  publishedAt: string;
}

/**
 * "Base de datos" de convocatorias internas simulada (HU-BE-16 y 17), en localStorage para que
 * varias pestañas compartan los mismos cupos y postulaciones, como con el backend real. Cupos y
 * postulaciones se guardan juntos: asignar un cupo es una sola escritura.
 */
export interface ProjectsDb {
  projects: ProjectRecord[];
  applications: ApplicationRecord[];
  sequence: number;
}

export const PROJECTS_DB_KEY = 'zeal.mock.proyectos';

/** Convocatorias del Figma B8, con fechas de cierre relativas a `now`. */
export function seedProjectsDb(now: Date): ProjectsDb {
  const closesIn = (days: number) => addDays(now, days).toISOString();
  const publishedAgo = (days: number) => addDays(now, -days).toISOString();
  return {
    applications: [],
    sequence: 0,
    projects: [
      {
        id: 'proyecto-observabilidad',
        organization: SEED_ORGANIZATION,
        publishedAt: publishedAgo(3),
        title: 'Squad de Observabilidad',
        area: 'Plataforma',
        cohort: 'Semilla 2026-2',
        summary: 'Instrumentar trazas y métricas del core de reservas.',
        capacity: 3,
        occupied: 3,
        version: 1,
        closesAt: closesIn(2),
        description: [
          'Vas a instrumentar trazas y métricas del core de reservas junto al equipo de plataforma: definir los SLI del flujo de agendamiento, montar los dashboards y dejar alertas que avisen antes de que el usuario note algo.',
          'Dedicación de 6 horas semanales durante un trimestre, sin dejar tu equipo actual. Tu líder ya avaló la convocatoria.',
        ],
        requirements: [
          'Haber hecho al menos un feature end-to-end',
          'Manejo básico de logs y métricas',
          'Ganas de documentar lo que aprendas',
        ],
        skills: [
          'Liderar una iniciativa · hito 4',
          'Gestión de incidentes +12%',
          'Diseño de sistemas +8%',
        ],
      },
      {
        id: 'proyecto-mentoria-inversa',
        organization: SEED_ORGANIZATION,
        publishedAt: publishedAgo(6),
        title: 'Mentoría inversa Gen Z',
        area: 'Cultura',
        cohort: 'Talento Humano',
        summary: 'Enséñale a un líder senior cómo trabaja tu generación.',
        capacity: 8,
        occupied: 5,
        version: 1,
        closesAt: closesIn(9),
        description: [
          'Te emparejamos con una persona del equipo directivo durante dos meses para compartir herramientas, hábitos y formas de colaborar.',
          'Una conversación quincenal de 45 minutos, con una guía de temas que puedes ajustar.',
        ],
        requirements: ['Curiosidad y paciencia para explicar', 'Disponibilidad quincenal'],
        skills: ['Comunicación +10%', 'Influencia sin autoridad · hito 2'],
      },
      {
        id: 'proyecto-guardia-datos',
        organization: SEED_ORGANIZATION,
        publishedAt: publishedAgo(9),
        title: 'Data Platform · Turno de guardia',
        area: 'Datos',
        cohort: 'Rotación trimestral',
        summary: 'Acompañar el oncall con un mentor durante 6 semanas.',
        capacity: 4,
        occupied: 2,
        version: 1,
        closesAt: closesIn(5),
        description: [
          'Rotarás en el turno de guardia de la plataforma de datos acompañada por un mentor: atenderás alertas, escribirás postmortems y mejorarás los runbooks.',
        ],
        requirements: ['Conocer SQL', 'Disponibilidad para una guardia por semana'],
        skills: ['Gestión de incidentes +15%', 'Datos en producción +6%'],
      },
      {
        id: 'proyecto-accesibilidad',
        organization: SEED_ORGANIZATION,
        publishedAt: publishedAgo(12),
        title: 'Accesibilidad en producto',
        area: 'Producto',
        cohort: 'Iniciativa transversal',
        summary: 'Auditar y corregir el flujo de reserva con criterios WCAG.',
        capacity: 6,
        occupied: 1,
        version: 1,
        closesAt: closesIn(12),
        description: [
          'Auditarás el flujo de reserva con lectores de pantalla y navegación por teclado, y propondrás correcciones priorizadas según WCAG 2.1 AA.',
        ],
        requirements: ['Interés en accesibilidad', 'Ganas de probar con usuarios reales'],
        skills: ['Diseño inclusivo +12%', 'Calidad de producto +5%'],
      },
      {
        id: 'proyecto-mentorias-cruzadas',
        organization: SEED_ORGANIZATION,
        publishedAt: publishedAgo(30),
        title: 'Piloto de mentorías cruzadas',
        area: 'Cultura',
        cohort: 'Semilla 2026-1',
        summary: 'Mentorías entre áreas para compartir experiencia.',
        capacity: 6,
        occupied: 5,
        version: 1,
        closesAt: closesIn(-4),
        description: ['Programa piloto de mentorías entre áreas de la empresa.'],
        requirements: [],
        skills: [],
      },
      {
        id: 'proyecto-otra-empresa',
        organization: OTHER_ORGANIZATION,
        publishedAt: publishedAgo(1),
        title: 'Proyecto de otra empresa',
        area: 'Ventas',
        cohort: 'Semilla 2026-2',
        summary: 'Este proyecto pertenece a otra organización y nunca debe verse aquí.',
        capacity: 2,
        occupied: 0,
        version: 1,
        closesAt: closesIn(7),
        description: ['Solo lo ven las personas de esa empresa.'],
        requirements: [],
        skills: [],
      },
    ],
  };
}

function isProjectsDb(value: unknown): value is ProjectsDb {
  return (
    typeof value === 'object' &&
    value !== null &&
    'projects' in value &&
    Array.isArray(value.projects) &&
    value.projects.every(
      (project: unknown) =>
        typeof project === 'object' &&
        project !== null &&
        'organization' in project &&
        typeof project.organization === 'string',
    ) &&
    'applications' in value &&
    Array.isArray(value.applications) &&
    'sequence' in value &&
    typeof value.sequence === 'number'
  );
}

export function readProjectsDb(): ProjectsDb {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(PROJECTS_DB_KEY) ?? 'null');
    if (isProjectsDb(stored)) {
      return stored;
    }
  } catch {
    // Datos corruptos: se vuelve a sembrar.
  }
  const seeded = seedProjectsDb(new Date());
  writeProjectsDb(seeded);
  return seeded;
}

export function writeProjectsDb(db: ProjectsDb): void {
  localStorage.setItem(PROJECTS_DB_KEY, JSON.stringify(db));
}

/** Avisa por el canal de la convocatoria sus cupos actuales. */
export function publishSpots(project: ProjectDetail): SpotsEvent {
  const event: SpotsEvent = {
    type: 'CUPOS',
    projectId: project.id,
    capacity: project.capacity,
    occupied: project.occupied,
    version: project.version,
  };
  publishMockEvent(projectTopic(project.id), event);
  return event;
}

/**
 * Cambia los cupos ocupados de una convocatoria y lo avisa por su canal, como el servidor cuando
 * otra persona toma o libera un cupo. Cada cambio sube la versión.
 */
export function updateOccupiedSpots(projectId: string, occupied: number): SpotsEvent {
  const db = readProjectsDb();
  const project = db.projects.find(({ id }) => id === projectId);
  if (project === undefined) {
    throw new Error(`No existe la convocatoria ${projectId}`);
  }
  project.occupied = Math.min(Math.max(occupied, 0), project.capacity);
  project.version += 1;
  writeProjectsDb(db);
  return publishSpots(project);
}
