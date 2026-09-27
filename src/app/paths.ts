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

/** Pantalla de llegada de cada rol después de iniciar sesión (Figma B1, C1 y D1). */
export const ROLE_HOME_PATH: Record<Role, string> = {
  EMPLEADO: `${ROLE_BASE_PATH.EMPLEADO}/inicio`,
  PSICOLOGO: `${ROLE_BASE_PATH.PSICOLOGO}/agenda`,
  ADMIN: `${ROLE_BASE_PATH.ADMIN}/panel`,
};

/** Rutas del psicólogo con pantalla propia. La sala cuelga de la agenda, desde donde se entra. */
export const PSYCHOLOGIST_PATHS = {
  agenda: ROLE_HOME_PATH.PSICOLOGO,
  availability: `${ROLE_BASE_PATH.PSICOLOGO}/disponibilidad`,
  sessionRoom: `${ROLE_HOME_PATH.PSICOLOGO}/sala/:reservationId`,
} as const;

/** Rutas del empleado con pantalla propia. El perfil de un psicólogo cuelga de Bienestar. */
export const EMPLOYEE_PATHS = {
  wellbeing: `${ROLE_BASE_PATH.EMPLEADO}/bienestar`,
  appointments: `${ROLE_BASE_PATH.EMPLEADO}/mis-citas`,
  psychologist: `${ROLE_BASE_PATH.EMPLEADO}/bienestar/psicologos/:psychologistId`,
} as const;

export function psychologistPath(psychologistId: string): string {
  return generatePath(EMPLOYEE_PATHS.psychologist, { psychologistId });
}

/** Estado con el que el directorio abre un perfil, para volver con los mismos filtros. */
export interface DirectoryReturnState {
  directorySearch: string;
}

/** Vuelta al directorio con los filtros que tenía; el estado de navegación se valida antes de usarse. */
export function directoryReturnPath(navigationState: unknown): string {
  const search =
    isRecord(navigationState) &&
    typeof navigationState.directorySearch === 'string' &&
    navigationState.directorySearch.startsWith('?')
      ? navigationState.directorySearch
      : '';
  return `${EMPLOYEE_PATHS.wellbeing}${search}`;
}

/** Sala de la sesión de una reserva. */
export function sessionRoomPath(reservationId: string): string {
  return generatePath(PSYCHOLOGIST_PATHS.sessionRoom, { reservationId });
}

/** Estado de navegación con el que una ruta protegida manda al login. */
export interface LoginRedirectState {
  from: string;
}

/**
 * Destino después de iniciar sesión: la ruta que se pidió antes del login si pertenece al rol,
 * o la pantalla de llegada del rol. El estado de navegación se valida antes de usarse.
 */
export function resolvePostLoginPath(role: Role, navigationState: unknown): string {
  const from =
    isRecord(navigationState) && typeof navigationState.from === 'string'
      ? navigationState.from
      : '';
  return from.startsWith(`${ROLE_BASE_PATH[role]}/`) ? from : ROLE_HOME_PATH[role];
}
