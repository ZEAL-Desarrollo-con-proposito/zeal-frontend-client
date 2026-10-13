import { isRecord } from '@/features/auth/model/session';
import { normalizeForSearch } from '@/shared/lib/text';

/** Lo que la empresa ve de cada persona: datos de contacto, nunca nada de su bienestar. */
export interface Employee {
  id: string;
  fullName: string;
  email: string;
}

export function isEmployee(value: unknown): value is Employee {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.fullName === 'string' &&
    typeof value.email === 'string'
  );
}

/** Busca por nombre o correo, sin importar tildes ni mayúsculas. */
export function filterEmployees(employees: readonly Employee[], query: string): Employee[] {
  const term = normalizeForSearch(query.trim());
  if (term === '') {
    return [...employees];
  }
  return employees.filter(
    ({ fullName, email }) =>
      normalizeForSearch(fullName).includes(term) || normalizeForSearch(email).includes(term),
  );
}

export function employeesCountLabel(count: number): string {
  return count === 1 ? '1 persona' : `${String(count)} personas`;
}
