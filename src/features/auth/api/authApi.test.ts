import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { startRefreshFamily } from '@/mocks/refreshSession';
import { server } from '@/mocks/server';
import { ApiError } from '@/shared/api/errors';
import { seedUser } from '@/test/credentials';
import {
  InvalidSessionResponseError,
  logout,
  LOGOUT_ENDPOINT,
  MICROSOFT_LOGIN_ENDPOINT,
  REFRESH_ENDPOINT,
  refreshSession,
  startMicrosoftLogin,
} from './authApi';

/** La misma dirección sin TLS: lo que el cliente debe rechazar fuera del propio equipo. */
function withoutTls(url: string): string {
  return url.replace(/^https:/, 'http:');
}

describe('authApi.startMicrosoftLogin', () => {
  it('pide al servidor la dirección de Microsoft con la cookie y sin token', async () => {
    let received: unknown = null;
    let credentials = '';
    server.use(
      http.post(`*${MICROSOFT_LOGIN_ENDPOINT}`, async ({ request }) => {
        received = await request.json();
        credentials = request.credentials;
        return HttpResponse.json({
          authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?x=1',
        });
      }),
    );

    await expect(startMicrosoftLogin({ remember: true, returnTo: '/login' })).resolves.toBe(
      'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?x=1',
    );
    expect(received).toEqual({ remember: true, returnTo: '/login' });
    expect(credentials).toBe('include');
  });

  it('el simulador responde una página de la propia app', async () => {
    await expect(startMicrosoftLogin({ remember: false, returnTo: '/login' })).resolves.toMatch(
      /^\/simulador\/microsoft\?state=/,
    );
  });

  it.each([
    'http://localhost:8090/microsoft/authorize?state=x',
    'http://127.0.0.1:8090/microsoft/authorize?state=x',
    'http://[::1]:8090/microsoft/authorize?state=x',
  ])('acepta el proveedor de prueba del propio equipo (%s)', async (authorizationUrl) => {
    server.use(
      http.post(`*${MICROSOFT_LOGIN_ENDPOINT}`, () => HttpResponse.json({ authorizationUrl })),
    );

    await expect(startMicrosoftLogin({ remember: false, returnTo: '/login' })).resolves.toBe(
      authorizationUrl,
    );
  });

  it.each([
    ['sin dirección', {}],
    ['con una dirección que no es texto', { authorizationUrl: 7 }],
    ['que no es https', { authorizationUrl: 'wss://login.microsoftonline.com/authorize' }],
    [
      'http hacia otro equipo',
      { authorizationUrl: withoutTls('https://login.microsoftonline.com/authorize') },
    ],
    [
      'http hacia un dominio parecido',
      { authorizationUrl: withoutTls('https://localhost.evil.co/authorize') },
    ],
    ['que ejecuta código', { authorizationUrl: 'javascript:alert(1)' }],
    ['mal formada', { authorizationUrl: 'https://[' }],
    ['sin cuerpo JSON de objeto', null],
  ])('no navega con una respuesta %s', async (_case, payload) => {
    server.use(http.post(`*${MICROSOFT_LOGIN_ENDPOINT}`, () => HttpResponse.json(payload)));

    await expect(
      startMicrosoftLogin({ remember: false, returnTo: '/login' }),
    ).rejects.toBeInstanceOf(InvalidSessionResponseError);
  });
});

describe('authApi.refreshSession (forma de la sesión)', () => {
  it.each([
    ['sin token', { user: seedUser('ADMIN') }],
    ['con un rol desconocido', { accessToken: 'token', user: { ...seedUser('ADMIN'), role: 'X' } }],
    ['con un token sin vencimiento', { accessToken: 'token-opaco', user: seedUser('ADMIN') }],
    ['sin cuerpo JSON de objeto', null],
  ])('rechaza una respuesta %s', async (_case, payload) => {
    server.use(http.post(`*${REFRESH_ENDPOINT}`, () => HttpResponse.json(payload)));

    await expect(refreshSession()).rejects.toBeInstanceOf(InvalidSessionResponseError);
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
