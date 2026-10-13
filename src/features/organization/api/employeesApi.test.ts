import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/mocks/server';
import { InvalidResponseError } from '@/shared/api/errors';
import { EMPLOYEES_ENDPOINT, fetchEmployees } from './employeesApi';

describe('fetchEmployees', () => {
  it('descarta una respuesta con otro formato', async () => {
    server.use(
      http.get(`*${EMPLOYEES_ENDPOINT}`, () => HttpResponse.json([{ id: 'u1', fullName: 'Ana' }])),
    );
    await expect(fetchEmployees()).rejects.toBeInstanceOf(InvalidResponseError);
  });

  it('descarta una respuesta que no es una lista', async () => {
    server.use(http.get(`*${EMPLOYEES_ENDPOINT}`, () => HttpResponse.json({})));
    await expect(fetchEmployees()).rejects.toBeInstanceOf(InvalidResponseError);
  });
});
