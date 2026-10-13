import { InvalidResponseError } from '@/shared/api/errors';
import { request } from '@/shared/api/httpClient';
import type { Employee } from '../model/employee';
import { isEmployee } from '../model/employee';

export const EMPLOYEES_ENDPOINT = '/api/organizacion/empleados';

/** Empleados de la empresa del administrador, en orden alfabético. */
export async function fetchEmployees(signal?: AbortSignal): Promise<Employee[]> {
  const payload = await request(EMPLOYEES_ENDPOINT, { signal });
  if (!Array.isArray(payload) || !payload.every(isEmployee)) {
    throw new InvalidResponseError('los empleados');
  }
  return payload;
}
