import type { Role } from '@/features/auth/model/session';

export const PATHS = {
  root: '/',
  login: '/login',
} as const;

/** Pantalla de llegada de cada rol después de iniciar sesión (Figma B1, C1 y D1). */
export const ROLE_HOME_PATH: Record<Role, string> = {
  EMPLEADO: '/empleado/inicio',
  PSICOLOGO: '/psicologo/agenda',
  ADMIN: '/admin/panel',
};
