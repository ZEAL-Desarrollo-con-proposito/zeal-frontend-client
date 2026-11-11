import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startRefreshFamily } from '@/mocks/refreshSession';
import { server } from '@/mocks/server';
import { seedUser } from '@/test/credentials';
import { LOGOUT_ENDPOINT, REFRESH_ENDPOINT } from './authApi';
import {
  markLoginInProgress,
  PENDING_LOGOUT_KEY,
  renewSession,
  restoreSession,
  revokeSession,
  setLogoutPending,
  takeLoginInProgress,
} from './sessionLifecycle';

/** Cuenta las peticiones de cerrar sesión y de renovar. */
function countAuthRequests() {
  const counts = { refresh: 0, logout: 0 };
  server.events.on('request:start', ({ request }) => {
    const { pathname } = new URL(request.url);
    counts.refresh += pathname === REFRESH_ENDPOINT ? 1 : 0;
    counts.logout += pathname === LOGOUT_ENDPOINT ? 1 : 0;
  });
  return counts;
}

function blockStorage(method: 'getItem' | 'setItem' | 'removeItem') {
  vi.spyOn(Storage.prototype, method).mockImplementation(() => {
    throw new DOMException('Bloqueado', 'SecurityError');
  });
}

afterEach(() => {
  server.events.removeAllListeners();
});

describe('inicio de sesión en curso (ida y vuelta a Microsoft)', () => {
  it('la pestaña recuerda que fue a iniciar sesión y lo dice una sola vez al volver', () => {
    markLoginInProgress();

    expect(takeLoginInProgress()).toBe(true);
    expect(takeLoginInProgress()).toBe(false);
  });

  it('sin almacenamiento no se recuerda: las demás pestañas recuperan la sesión al recargar', () => {
    blockStorage('setItem');
    markLoginInProgress();
    vi.restoreAllMocks();
    expect(takeLoginInProgress()).toBe(false);

    sessionStorage.setItem('zeal.login.en-curso', 'true');
    blockStorage('getItem');
    expect(takeLoginInProgress()).toBe(false);
  });
});

describe('renewSession', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'locks');
  });

  it('dos renovaciones a la vez gastan la cookie una sola vez', async () => {
    startRefreshFamily(seedUser('EMPLEADO').id, false);
    const counts = countAuthRequests();

    const [first, second] = await Promise.all([renewSession(), renewSession()]);

    expect(second).toBe(first);
    expect(first.user).toEqual(seedUser('EMPLEADO'));
    expect(counts.refresh).toBe(1);
  });

  it('terminada una renovación, la siguiente vuelve a preguntar al servidor', async () => {
    startRefreshFamily(seedUser('EMPLEADO').id, false);
    const counts = countAuthRequests();

    await renewSession();
    await renewSession();

    expect(counts.refresh).toBe(2);
  });

  it('entre pestañas renueva una a la vez con el candado del navegador', async () => {
    startRefreshFamily(seedUser('ADMIN').id, false);
    const request = vi.fn((_name: string, task: () => Promise<unknown>) => task());
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request } });

    const session = await renewSession();

    expect(session.user).toEqual(seedUser('ADMIN'));
    expect(request).toHaveBeenCalledExactlyOnceWith('zeal.auth.renovacion', expect.any(Function));
  });
});

describe('revokeSession', () => {
  it('revoca la cookie en el servidor y no deja nada pendiente', async () => {
    setLogoutPending(true);
    const counts = countAuthRequests();

    await revokeSession();

    expect(counts.logout).toBe(1);
    expect(localStorage.getItem(PENDING_LOGOUT_KEY)).toBeNull();
  });

  it.each([
    ['sin conexión', () => HttpResponse.error()],
    ['con el servidor fallando', () => new HttpResponse(null, { status: 503 })],
  ])('%s, recuerda que falta revocarla', async (_case, respond) => {
    server.use(http.post(`*${LOGOUT_ENDPOINT}`, respond));

    await revokeSession();

    expect(localStorage.getItem(PENDING_LOGOUT_KEY)).not.toBeNull();
  });

  it('si el servidor ya no reconoce la cookie, no queda nada por revocar', async () => {
    server.use(http.post(`*${LOGOUT_ENDPOINT}`, () => new HttpResponse(null, { status: 401 })));

    await revokeSession();

    expect(localStorage.getItem(PENDING_LOGOUT_KEY)).toBeNull();
  });
});

describe('restoreSession', () => {
  it('recupera la sesión de la cookie vigente', async () => {
    startRefreshFamily(seedUser('PSICOLOGO').id, true);

    const session = await restoreSession();

    expect(session?.user).toEqual(seedUser('PSICOLOGO'));
  });

  it('sin cookie vigente no hay sesión', async () => {
    await expect(restoreSession()).resolves.toBeNull();
  });

  it('con un cierre de sesión pendiente no entra con la cookie: termina de revocarla', async () => {
    startRefreshFamily(seedUser('EMPLEADO').id, true);
    setLogoutPending(true);
    const counts = countAuthRequests();

    await expect(restoreSession()).resolves.toBeNull();

    expect(counts).toEqual({ refresh: 0, logout: 1 });
    expect(localStorage.getItem(PENDING_LOGOUT_KEY)).toBeNull();
    await expect(restoreSession()).resolves.toBeNull();
  });

  it('funciona aunque el navegador bloquee el almacenamiento', async () => {
    blockStorage('getItem');
    blockStorage('setItem');
    blockStorage('removeItem');
    server.use(http.post(`*${REFRESH_ENDPOINT}`, () => new HttpResponse(null, { status: 401 })));

    await expect(restoreSession()).resolves.toBeNull();
    expect(() => {
      setLogoutPending(true);
    }).not.toThrow();
  });
});
