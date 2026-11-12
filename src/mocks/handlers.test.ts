import { describe, expect, it, vi } from 'vitest';
import { MICROSOFT_LOGIN_ENDPOINT } from '@/features/auth/api/authApi';
import { freezeTime } from '@/test/clock';
import { seedUser } from '@/test/credentials';
import { MICROSOFT_SIMULATOR_ENDPOINT, UNREGISTERED_ACCOUNT } from './microsoft/handlers';
import {
  LOGIN_BLOCK_MS,
  LOGIN_FAILURE_WINDOW_MS,
  LOGIN_MAX_FAILURES,
} from './microsoft/loginThrottle';

function post(path: string, body: unknown) {
  return fetch(new URL(path, window.location.origin), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function startLogin() {
  return post(MICROSOFT_LOGIN_ENDPOINT, { remember: false, returnTo: '/login' });
}

/** Empieza un inicio de sesión y vuelve del selector con esa cuenta (`null`: canceló). */
async function returnWith(email: string | null) {
  const start = await startLogin();
  const { authorizationUrl } = (await start.json()) as { authorizationUrl: string };
  const state = new URL(authorizationUrl, window.location.origin).searchParams.get('state');
  return post(MICROSOFT_SIMULATOR_ENDPOINT, { state, email });
}

async function failTimes(times: number) {
  for (let attempt = 0; attempt < times; attempt += 1) {
    await returnWith(UNREGISTERED_ACCOUNT);
  }
}

describe('API simulado · bloqueo por fuerza bruta (SEG-1)', () => {
  it.each([
    ['cuentas no registradas', () => returnWith(UNREGISTERED_ACCOUNT)],
    ['regresos inventados', () => post(MICROSOFT_SIMULATOR_ENDPOINT, { state: 'x', email: null })],
  ])('tras varios %s seguidos rechaza los inicios con 429 y Retry-After', async (_case, fail) => {
    for (let attempt = 0; attempt < LOGIN_MAX_FAILURES; attempt += 1) {
      await fail();
    }

    const response = await startLogin();

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe(String(LOGIN_BLOCK_MS / 1000));
    await expect(response.json()).resolves.toMatchObject({ error: 'Too Many Requests' });
  });

  it('cancelar no cuenta como fallo y un ingreso correcto reinicia la cuenta', async () => {
    await failTimes(LOGIN_MAX_FAILURES - 1);
    await returnWith(null);
    expect((await startLogin()).status).toBe(200);

    await returnWith(seedUser('EMPLEADO').email);
    await failTimes(LOGIN_MAX_FAILURES - 1);
    expect((await startLogin()).status).toBe(200);
  });

  it('los fallos viejos salen de la ventana y el bloqueo vence solo', async () => {
    freezeTime();
    await failTimes(LOGIN_MAX_FAILURES - 1);
    vi.setSystemTime(Date.now() + LOGIN_FAILURE_WINDOW_MS);
    await failTimes(1);
    expect((await startLogin()).status).toBe(200);

    await failTimes(LOGIN_MAX_FAILURES - 1);
    expect((await startLogin()).status).toBe(429);

    vi.setSystemTime(Date.now() + LOGIN_BLOCK_MS);
    expect((await startLogin()).status).toBe(200);
  });
});

describe('API simulado · inicio de sesión con Microsoft', () => {
  it.each([
    ['sin "recordarme"', { returnTo: '/login' }],
    ['con una ruta de regreso externa', { remember: false, returnTo: '//otro-sitio.com' }],
    ['con una ruta de regreso absoluta', { remember: false, returnTo: 'https://otro-sitio.com' }],
  ])('responde 400 %s', async (_case, body) => {
    const response = await post(MICROSOFT_LOGIN_ENDPOINT, body);

    expect(response.status).toBe(400);
  });

  it('cada regreso sirve una sola vez', async () => {
    const start = await startLogin();
    const { authorizationUrl } = (await start.json()) as { authorizationUrl: string };
    const state = new URL(authorizationUrl, window.location.origin).searchParams.get('state');

    const first = await post(MICROSOFT_SIMULATOR_ENDPOINT, { state, email: null });
    const second = await post(MICROSOFT_SIMULATOR_ENDPOINT, { state, email: null });

    await expect(first.json()).resolves.toEqual({ redirectTo: '/login?error=cancelado' });
    await expect(second.json()).resolves.toEqual({ redirectTo: '/login?error=fallo' });
  });
});
