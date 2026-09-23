import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/mocks/server';
import { DEMO_PASSWORD, seedUser } from '@/test/credentials';
import { InvalidSessionResponseError, login, LOGIN_ENDPOINT } from './authApi';

describe('authApi.login', () => {
  it('devuelve el token y el usuario autenticado', async () => {
    const employee = seedUser('EMPLEADO');

    const session = await login({ email: employee.email, password: DEMO_PASSWORD });

    expect(session.user).toEqual(employee);
    expect(session.accessToken.split('.')).toHaveLength(3);
  });

  it.each([
    ['sin token', { user: seedUser('ADMIN') }],
    ['con un rol desconocido', { accessToken: 'token', user: { ...seedUser('ADMIN'), role: 'X' } }],
    ['sin cuerpo JSON de objeto', null],
  ])('rechaza una respuesta %s', async (_case, payload) => {
    server.use(http.post(`*${LOGIN_ENDPOINT}`, () => HttpResponse.json(payload)));

    await expect(login({ email: 'a@b.co', password: 'x' })).rejects.toBeInstanceOf(
      InvalidSessionResponseError,
    );
  });
});
