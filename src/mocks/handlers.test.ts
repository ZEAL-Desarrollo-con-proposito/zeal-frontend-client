import { describe, expect, it } from 'vitest';
import { MICROSOFT_LOGIN_ENDPOINT } from '@/features/auth/api/authApi';
import { MICROSOFT_SIMULATOR_ENDPOINT } from './microsoft/handlers';

function post(path: string, body: unknown) {
  return fetch(new URL(path, window.location.origin), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

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
    const start = await post(MICROSOFT_LOGIN_ENDPOINT, { remember: false, returnTo: '/login' });
    const { authorizationUrl } = (await start.json()) as { authorizationUrl: string };
    const state = new URL(authorizationUrl, window.location.origin).searchParams.get('state');

    const first = await post(MICROSOFT_SIMULATOR_ENDPOINT, { state, email: null });
    const second = await post(MICROSOFT_SIMULATOR_ENDPOINT, { state, email: null });

    await expect(first.json()).resolves.toEqual({ redirectTo: '/login?error=cancelado' });
    await expect(second.json()).resolves.toEqual({ redirectTo: '/login?error=fallo' });
  });
});
