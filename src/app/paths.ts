import { generatePath } from 'react-router';
import type { Role } from '@/features/auth/model/session';
import { isRecord } from '@/features/auth/model/session';

export const PATHS = {
  root: '/',
  login: '/login',
} as const;

/** Prefijo de todas las rutas de cada rol: un rol nunca navega fuera de su prefijo. */
export const ROLE_BASE_PATH: Record<Role, string> = {
  EMPLEADO: '/empleado',
  PSICOLOGO: '/psicologo',
  ADMIN: '/admin',
};

/** Pantalla de llegada de cada rol después de iniciar sesión. */
export const ROLE_HOME_PATH: Record<Role, string> = {
  EMPLEADO: `${ROLE_BASE_PATH.EMPLEADO}/inicio`,
  PSICOLOGO: `${ROLE_BASE_PATH.PSICOLOGO}/agenda`,
  ADMIN: `${ROLE_BASE_PATH.ADMIN}/panel`,
};

/** Rutas del psicólogo. */
export const PSYCHOLOGIST_PATHS = {
  agenda: ROLE_HOME_PATH.PSICOLOGO,
  availability: `${ROLE_BASE_PATH.PSICOLOGO}/disponibilidad`,
  messages: `${ROLE_BASE_PATH.PSICOLOGO}/mensajes`,
  sessionRoom: `${ROLE_HOME_PATH.PSICOLOGO}/sala/:reservationId`,
} as const;

/** Rutas del empleado. */
/** Rutas del administrador. */
export const ADMIN_PATHS = {
  projects: `${ROLE_BASE_PATH.ADMIN}/proyectos`,
  workshops: `${ROLE_BASE_PATH.ADMIN}/talleres`,
  workshopRoom: `${ROLE_BASE_PATH.ADMIN}/talleres/sala/:workshopId`,
} as const;

export const EMPLOYEE_PATHS = {
  wellbeing: `${ROLE_BASE_PATH.EMPLEADO}/bienestar`,
  appointments: `${ROLE_BASE_PATH.EMPLEADO}/mis-citas`,
  messages: `${ROLE_BASE_PATH.EMPLEADO}/mensajes`,
  psychologist: `${ROLE_BASE_PATH.EMPLEADO}/bienestar/psicologos/:psychologistId`,
  sessionRoom: `${ROLE_BASE_PATH.EMPLEADO}/mis-citas/sala/:reservationId`,
  projects: `${ROLE_BASE_PATH.EMPLEADO}/proyectos`,
  project: `${ROLE_BASE_PATH.EMPLEADO}/proyectos/:projectId`,
  workshops: `${ROLE_BASE_PATH.EMPLEADO}/talleres`,
  myWorkshops: `${ROLE_BASE_PATH.EMPLEADO}/talleres/mis-talleres`,
  workshopRoom: `${ROLE_BASE_PATH.EMPLEADO}/talleres/sala/:workshopId`,
} as const;

/** Genera la ruta de la sala de video de un taller, para el empleado o para la empresa. */
export function workshopRoomPath(role: 'EMPLEADO' | 'ADMIN', workshopId: string): string {
  const path = role === 'ADMIN' ? ADMIN_PATHS.workshopRoom : EMPLOYEE_PATHS.workshopRoom;
  return generatePath(path, { workshopId });
}

/** Genera la ruta al detalle de una convocatoria interna. */
export function projectPath(projectId: string): string {
  return generatePath(EMPLOYEE_PATHS.project, { projectId });
}

/**
 * Enlace a un taller para el empleado: la sección de talleres con el taller en `?taller=`, que el
 * catálogo usa para destacarlo.
 */
export function workshopPath(workshopId: string): string {
  return `${EMPLOYEE_PATHS.workshops}?taller=${encodeURIComponent(workshopId)}`;
}

/** Genera la ruta al perfil de un psicólogo. */
export function psychologistPath(psychologistId: string): string {
  return generatePath(EMPLOYEE_PATHS.psychologist, {
    psychologistId,
  });
}

/** Estado con el que el directorio abre un perfil, para volver con los mismos filtros. */
export interface DirectoryReturnState {
  directorySearch: string;
}

/**
 * Vuelve al directorio conservando los filtros de búsqueda.
 * El estado de navegación se valida antes de utilizarse.
 */
export function directoryReturnPath(navigationState: unknown): string {
  const search =
    isRecord(navigationState) &&
    typeof navigationState.directorySearch === 'string' &&
    navigationState.directorySearch.startsWith('?')
      ? navigationState.directorySearch
      : '';

  return `${EMPLOYEE_PATHS.wellbeing}${search}`;
}

/** Genera la ruta de la sala de una sesión para el psicólogo. */
export function sessionRoomPath(reservationId: string): string {
  return generatePath(PSYCHOLOGIST_PATHS.sessionRoom, {
    reservationId,
  });
}

/** Genera la ruta de la sala de una cita para el empleado. */
export function employeeRoomPath(reservationId: string): string {
  return generatePath(EMPLOYEE_PATHS.sessionRoom, {
    reservationId,
  });
}

/** Estado de navegación con el que una ruta protegida manda al login. */
export interface LoginRedirectState {
  from: string;
}

/**
 * Determina a dónde enviar al usuario después de iniciar sesión.
 *
 * Si existe una ruta anterior perteneciente al rol del usuario,
 * se vuelve a ella. De lo contrario, se utiliza la pantalla
 * principal correspondiente al rol.
 */
export function resolvePostLoginPath(role: Role, navigationState: unknown): string {
  const from =
    isRecord(navigationState) && typeof navigationState.from === 'string'
      ? navigationState.from
      : '';

  const roleBasePath = ROLE_BASE_PATH[role];

  return from === roleBasePath || from.startsWith(`${roleBasePath}/`) ? from : ROLE_HOME_PATH[role];
}
