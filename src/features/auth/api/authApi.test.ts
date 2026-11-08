import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { startRefreshFamily } from '@/mocks/refreshSession';
import { server } from '@/mocks/server';
import { ApiError } from '@/shared/api/errors';
import { DEMO_PASSWORD, seedUser } from '@/test/credentials';
import {
  InvalidSessionResponseError,
  login,
  LOGIN_ENDPOINT,
  logout,
  LOGOUT_ENDPOINT,
  REFRESH_ENDPOINT,
  refreshSession,
} from './authApi';

describe('authApi.login', () => {
  it('devuelve el token y el usuario autenticado', async () => {
    const employee = seedUser('EMPLEADO');

    const session = await login({ email: employee.email, password: DEMO_PASSWORD }, false);

    expect(session.user).toEqual(employee);
    expect(session.accessToken.split('.')).toHaveLength(3);
    expect(session.expiresAt).toBeGreaterThan(Date.now());
  });

  it.each([true, false])(
    'le dice al servidor si debe recordar la sesión (%s)',
    async (remember) => {
      let received: unknown = null;
      server.use(
        http.post(`*${LOGIN_ENDPOINT}`, async ({ request }) => {
          received = await request.json();
          return HttpResponse.json({}, { status: 401 });
        }),
      );

      await login({ email: 'a@b.co', password: 'x' }, remember).catch(() => undefined);

      expect(received).toEqual({ email: 'a@b.co', password: 'x', remember });
    },
  );

  it.each([
    ['sin token', { user: seedUser('ADMIN') }],
    ['con un rol desconocido', { accessToken: 'token', user: { ...seedUser('ADMIN'), role: 'X' } }],
    ['con un token sin vencimiento', { accessToken: 'token-opaco', user: seedUser('ADMIN') }],
    ['sin cuerpo JSON de objeto', null],
  ])('rechaza una respuesta %s', async (_case, payload) => {
    server.use(http.post(`*${LOGIN_ENDPOINT}`, () => HttpResponse.json(payload)));

    await expect(login({ email: 'a@b.co', password: 'x' }, false)).rejects.toBeInstanceOf(
      InvalidSessionResponseError,
    );
  });
});

describe('authApi.refreshSession', () => {
  it('entrega una sesión nueva con la cookie de refresh', async () => {
    startRefreshFamily(seedUser('ADMIN').id, false);

    const session = await refreshSession();

    expect(session.user).toEqual(seedUser('ADMIN'));
  });

  it('sin cookie vigente el servidor responde 401', async () => {
    await expect(refreshSession()).rejects.toEqual(expect.any(ApiError));
    await expect(refreshSession()).rejects.toMatchObject({ status: 401 });
  });

  it('rechaza una respuesta que no es una sesión', async () => {
    server.use(http.post(`*${REFRESH_ENDPOINT}`, () => HttpResponse.json({ ok: true })));

    await expect(refreshSession()).rejects.toBeInstanceOf(InvalidSessionResponseError);
  });

  it('reutilizar una cookie ya rotada revoca toda la sesión (simulador, SEG-4)', async () => {
    startRefreshFamily(seedUser('EMPLEADO').id, false);
    const stolen = document.cookie.split('; ')[0] ?? '';
    await refreshSession();

    document.cookie = `${stolen}; Path=/`;

    await expect(refreshSession()).rejects.toMatchObject({ status: 401 });
    await expect(refreshSession()).rejects.toMatchObject({ status: 401 });
  });
});

describe('authApi.logout', () => {
  it('pide al servidor revocar la sesión', async () => {
    startRefreshFamily(seedUser('EMPLEADO').id, false);

    await logout();

    await expect(refreshSession()).rejects.toMatchObject({ status: 401 });
  });

  it('envía la cookie y no el token de la sesión', async () => {
    let authorization: string | null = 'sin leer';
    let credentials = '';
    server.use(
      http.post(`*${LOGOUT_ENDPOINT}`, ({ request }) => {
        authorization = request.headers.get('Authorization');
        credentials = request.credentials;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await logout();

    expect(authorization).toBeNull();
    expect(credentials).toBe('include');
  });
});
