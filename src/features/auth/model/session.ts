export const ROLES = ['EMPLEADO', 'PSICOLOGO', 'ADMIN'] as const;

export type Role = (typeof ROLES)[number];

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  organization: string;
}

/** Sesión que entrega el servidor al renovarla con la cookie (contrato con HU-BE-22). */
export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface Session extends LoginResponse {
  /** Vencimiento del token en milisegundos desde epoch (claim `exp` del JWT). */
  expiresAt: number;
}

export function isRole(value: unknown): value is Role {
  return ROLES.some((role) => role === value);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

export function isAuthUser(value: unknown): value is AuthUser {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.fullName) &&
    isNonEmptyString(value.email) &&
    isNonEmptyString(value.organization) &&
    isRole(value.role)
  );
}

export function isLoginResponse(value: unknown): value is LoginResponse {
  return isRecord(value) && isNonEmptyString(value.accessToken) && isAuthUser(value.user);
}
