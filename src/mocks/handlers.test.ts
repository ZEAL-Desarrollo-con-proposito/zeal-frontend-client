import { describe, expect, it } from 'vitest';
import { LOGIN_ENDPOINT } from '@/features/auth/api/authApi';
import { DEMO_PASSWORD, seedUser } from '@/test/credentials';
import { LOGIN_MAX_FAILURES } from './loginThrottle';

function postLogin(body: unknown) {
  return fetch(new URL(LOGIN_ENDPOINT, window.location.origin), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('API simulado · POST /api/auth/login', () => {
  it('responde 400 si faltan el correo o la contraseña', async () => {
    const response = await postLogin({ email: 'david.cajamarca@nexura.co' });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'Bad Request' });
  });

  it('responde 401 con credenciales incorrectas', async () => {
    const response = await postLogin({ email: 'david.cajamarca@nexura.co', password: 'otra' });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      status: 401,
      error: 'Unauthorized',
      message: 'Correo o contraseña incorrectos',
    });
  });

  it('bloquea el origen tras superar el umbral de fallos, incluso con credenciales válidas', async () => {
    for (let attempt = 0; attempt < LOGIN_MAX_FAILURES; attempt += 1) {
      const response = await postLogin({
        email: seedUser('EMPLEADO').email,
        password: 'incorrecta',
      });
      expect(response.status).toBe(401);
    }

    const response = await postLogin({
      email: seedUser('EMPLEADO').email,
      password: DEMO_PASSWORD,
    });

    expect(response.status).toBe(429);
    expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0);
    await expect(response.json()).resolves.toMatchObject({
      status: 429,
      error: 'Too Many Requests',
    });
  });
});
