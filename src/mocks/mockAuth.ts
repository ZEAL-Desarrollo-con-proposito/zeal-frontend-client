import { HttpResponse } from 'msw';
import type { AuthUser, Role } from '@/features/auth/model/session';
import { readMockTokenSubject } from './mockToken';
import { SEED_USERS } from './seedUsers';

export function errorBody(status: number, error: string, message: string) {
  return HttpResponse.json({ status, error, message }, { status });
}

/** Identifica a quien hace la petición por su token (401 si no es válido), sin importar el rol. */
export function authenticate(request: Request): AuthUser | Response {
  const header = request.headers.get('Authorization') ?? '';
  const subject = header.startsWith('Bearer ') ? readMockTokenSubject(header.slice(7)) : null;
  const user = SEED_USERS.find((candidate) => candidate.id === subject);
  return user ?? errorBody(401, 'Unauthorized', 'Tu sesión no es válida. Vuelve a iniciar sesión.');
}

/**
 * Autoriza una petición como lo haría el backend: token válido (401) y rol permitido (403).
 * Devuelve el usuario o la respuesta de error lista para retornar.
 */
export function authorize(request: Request, role: Role): AuthUser | Response {
  const user = authenticate(request);
  if (user instanceof Response) {
    return user;
  }
  if (user.role !== role) {
    return errorBody(403, 'Forbidden', 'No tienes permiso para esta operación.');
  }
  return user;
}
