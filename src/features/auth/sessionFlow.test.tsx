import { act, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { ROLE_HOME_PATH } from '@/app/paths';
import { createMockRealtimeClient } from '@/mocks/realtime';
import { createMockToken } from '@/mocks/mockToken';
import { startRefreshFamily } from '@/mocks/refreshSession';
import { server } from '@/mocks/server';
import { request } from '@/shared/api/httpClient';
import type { RealtimeCredentials } from '@/shared/realtime/realtimeClient';
import { DEMO_PASSWORD, seedUser, storeSession } from '@/test/credentials';
import { renderRoute } from '@/test/renderRoute';
import { LOGIN_ENDPOINT, LOGOUT_ENDPOINT, REFRESH_ENDPOINT } from './api/authApi';
import { PENDING_LOGOUT_KEY, renewSession } from './api/sessionLifecycle';
import type { SessionEvent } from './context/AuthProvider';
import { RENEW_RETRY_MS, SESSION_CHANNEL } from './context/AuthProvider';
import type { Role } from './model/session';
import { sessionStore } from './storage/sessionStore';

const EXPIRED_NOTICE = 'Tu sesión expiró por seguridad. Vuelve a iniciar sesión para continuar.';
const RESTORING = 'Recuperando tu sesión…';

async function loginAs(
  user: Awaited<ReturnType<typeof renderRoute>>['user'],
  email: string,
  { remember = false } = {},
) {
  await user.type(screen.getByLabelText('Correo corporativo'), email);
  await user.type(screen.getByLabelText('Contraseña'), DEMO_PASSWORD);
  if (remember) {
    await user.click(screen.getByRole('checkbox', { name: 'Recordarme' }));
  }
  await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
}

/** Todo lo que el navegador guarda fuera de la memoria de la pestaña. */
function browserStorage(): string {
  const values = (storage: Storage) =>
    Array.from({ length: storage.length }, (_, index) => storage.getItem(storage.key(index) ?? ''));
  return JSON.stringify([...values(localStorage), ...values(sessionStorage)]);
}

/** Respuesta del servidor a una renovación: un token distinto cada vez (vence más tarde). */
function renewedSessionFor(role: Role) {
  const user = seedUser(role);
  return () => HttpResponse.json({ accessToken: createMockToken(user, Date.now() + 60_000), user });
}

/** Sin cookie, la recuperación al abrir termina en nada; se comparte la que esté en curso. */
async function initialRestoreFinished() {
  await act(async () => {
    await renewSession().catch(() => undefined);
  });
}

/** Otra pestaña del mismo navegador. */
function otherTab() {
  const channel = new BroadcastChannel(SESSION_CHANNEL);
  const received: SessionEvent[] = [];
  channel.onmessage = ({ data }: MessageEvent<SessionEvent>) => {
    received.push(data);
  };
  onTestFinished(() => {
    channel.close();
  });
  return {
    received,
    say(event: SessionEvent) {
      channel.postMessage(event);
    },
  };
}

describe('sesión en memoria (HU-FE-21)', () => {
  it('no deja el token en el almacenamiento del navegador', async () => {
    const { user } = await renderRoute('/login');

    await loginAs(user, seedUser('EMPLEADO').email, { remember: true });

    expect(await screen.findByRole('heading', { name: 'Hola, David' })).toBeInTheDocument();
    const token = sessionStore.accessToken() ?? '';
    expect(token).not.toBe('');
    expect(browserStorage()).not.toContain(token);
    expect(browserStorage()).not.toContain('accessToken');
  });

  it.each([true, false])(
    'le pide al servidor recordar la sesión solo si se marca (%s)',
    async (remember) => {
      let received: unknown = null;
      server.use(
        http.post(`*${LOGIN_ENDPOINT}`, async ({ request: incoming }) => {
          received = await incoming.json();
          return HttpResponse.json({ message: 'Correo o contraseña incorrectos' }, { status: 401 });
        }),
      );
      const { user } = await renderRoute('/login');

      await loginAs(user, seedUser('ADMIN').email, { remember });

      await waitFor(() => {
        expect(received).toMatchObject({ remember });
      });
    },
  );

  it('al recargar recupera la sesión con la cookie de refresh, sin pasar por el login', async () => {
    startRefreshFamily(seedUser('PSICOLOGO').id, true);

    const { router } = await renderRoute(ROLE_HOME_PATH.PSICOLOGO);

    expect(screen.getByText(RESTORING)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Mi agenda' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(ROLE_HOME_PATH.PSICOLOGO);
  });

  it('desde el login también la recupera y lleva a la pantalla del rol', async () => {
    startRefreshFamily(seedUser('PSICOLOGO').id, false);

    const { router } = await renderRoute('/login');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(ROLE_HOME_PATH.PSICOLOGO);
    });
  });

  it('con la sesión ya en memoria no vuelve a pedir el login', async () => {
    storeSession('PSICOLOGO');

    const { router } = await renderRoute('/login');

    expect(router.state.location.pathname).toBe(ROLE_HOME_PATH.PSICOLOGO);
    expect(screen.getByRole('heading', { name: 'Mi agenda' })).toBeInTheDocument();
  });

  it('borra el token que una versión anterior dejó guardado', async () => {
    localStorage.setItem('zeal.session', 'token-viejo');
    sessionStorage.setItem('zeal.session', 'token-viejo');

    await renderRoute('/login');

    expect(localStorage.getItem('zeal.session')).toBeNull();
    expect(sessionStorage.getItem('zeal.session')).toBeNull();
  });
});

describe('manejo de la sesión y rutas protegidas', () => {
  it('manda al login a quien abre una ruta protegida sin sesión', async () => {
    const { router, user } = await renderRoute(ROLE_HOME_PATH.ADMIN);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
    expect(screen.queryByText(EXPIRED_NOTICE)).not.toBeInTheDocument();

    // Quien pidió la ruta de admin pero es empleado llega a su propia pantalla, no a un 403.
    await loginAs(user, seedUser('EMPLEADO').email);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(ROLE_HOME_PATH.EMPLEADO);
    });
  });

  it('niega el acceso a las rutas de otro rol y ofrece volver al inicio propio', async () => {
    storeSession('EMPLEADO');
    const { router, user } = await renderRoute(ROLE_HOME_PATH.ADMIN);

    expect(
      screen.getByRole('heading', { name: 'Esta sección no está disponible para tu rol' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Ir a mi inicio' }));
    expect(router.state.location.pathname).toBe(ROLE_HOME_PATH.EMPLEADO);
  });
});

describe('cerrar sesión', () => {
  afterEach(() => {
    server.events.removeAllListeners();
  });

  it('revoca en el servidor, avisa a las demás pestañas y no muestra el aviso de vencimiento', async () => {
    const tab = otherTab();
    let revoked = 0;
    server.events.on('request:start', ({ request: incoming }) => {
      revoked += new URL(incoming.url).pathname === LOGOUT_ENDPOINT ? 1 : 0;
    });
    storeSession('EMPLEADO');
    const { router, user } = await renderRoute(ROLE_HOME_PATH.EMPLEADO);

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(router.state.location.pathname).toBe('/login');
    expect(sessionStore.load()).toBeNull();
    expect(screen.queryByText(EXPIRED_NOTICE)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(revoked).toBe(1);
    });
    await waitFor(() => {
      expect(tab.received).toEqual([{ type: 'ended', expired: false }]);
    });
  });

  it('sin conexión, no vuelve a entrar con la cookie al recargar', async () => {
    server.use(http.post(`*${LOGOUT_ENDPOINT}`, () => HttpResponse.error()));
    startRefreshFamily(seedUser('EMPLEADO').id, true);
    const first = await renderRoute(ROLE_HOME_PATH.EMPLEADO);
    await screen.findByRole('heading', { name: 'Hola, David' });

    await first.user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => {
      expect(localStorage.getItem(PENDING_LOGOUT_KEY)).not.toBeNull();
    });
    first.unmount();
    server.resetHandlers();

    const { router } = await renderRoute(ROLE_HOME_PATH.EMPLEADO);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
    await waitFor(() => {
      expect(localStorage.getItem(PENDING_LOGOUT_KEY)).toBeNull();
    });
  });

  it('una renovación que estaba en curso no revive la sesión cerrada', async () => {
    const held: { reached: boolean; answer: () => void } = {
      reached: false,
      answer: () => undefined,
    };
    server.use(
      http.post(`*${REFRESH_ENDPOINT}`, async () => {
        await new Promise<void>((resolve) => {
          held.answer = resolve;
          held.reached = true;
        });
        return renewedSessionFor('EMPLEADO')();
      }),
    );
    storeSession('EMPLEADO', { expiresInMs: 50 });
    const { router, user } = await renderRoute(ROLE_HOME_PATH.EMPLEADO);
    await waitFor(() => {
      expect(held.reached).toBe(true);
    });

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
    await act(async () => {
      held.answer();
      await renewSession(); // La misma renovación en curso: termina junto con la de la pantalla.
    });

    expect(router.state.location.pathname).toBe('/login');
    expect(sessionStore.load()).toBeNull();
  });
});

describe('renovar la sesión', () => {
  it('antes de vencer pide un token nuevo y la persona sigue en su pantalla', async () => {
    server.use(http.post(`*${REFRESH_ENDPOINT}`, renewedSessionFor('PSICOLOGO')));
    const session = storeSession('PSICOLOGO', { expiresInMs: 50 });
    const { router } = await renderRoute(ROLE_HOME_PATH.PSICOLOGO);

    await waitFor(() => {
      expect(sessionStore.accessToken()).not.toBe(session.accessToken);
    });

    expect(router.state.location.pathname).toBe(ROLE_HOME_PATH.PSICOLOGO);
    expect(screen.queryByText(EXPIRED_NOTICE)).not.toBeInTheDocument();
  });

  it('si el servidor rechaza la renovación, cierra la sesión y lo avisa en el login', async () => {
    const tab = otherTab();
    storeSession('PSICOLOGO', { expiresInMs: 50 });
    const { router } = await renderRoute(ROLE_HOME_PATH.PSICOLOGO);

    expect(await screen.findByText(EXPIRED_NOTICE)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(sessionStore.load()).toBeNull();
    await waitFor(() => {
      expect(tab.received).toEqual([{ type: 'ended', expired: true }]);
    });
  });

  it('si el servidor no responde, la sesión sigue y vuelve a intentarlo más tarde', async () => {
    const realSetTimeout = window.setTimeout.bind(window);
    const retries: (() => void)[] = [];
    vi.spyOn(window, 'setTimeout').mockImplementation(((
      callback: () => void,
      ms?: number,
    ): number => {
      if (ms === RENEW_RETRY_MS) {
        retries.push(callback);
        return 0;
      }
      return realSetTimeout(callback, ms);
    }) as typeof window.setTimeout);
    server.use(
      http.post(`*${REFRESH_ENDPOINT}`, () => new HttpResponse(null, { status: 503 }), {
        once: true,
      }),
    );
    const session = storeSession('PSICOLOGO', { expiresInMs: 50 });
    const { router } = await renderRoute(ROLE_HOME_PATH.PSICOLOGO);

    await waitFor(() => {
      expect(retries).toHaveLength(1);
    });
    expect(router.state.location.pathname).toBe(ROLE_HOME_PATH.PSICOLOGO);
    expect(screen.queryByText(EXPIRED_NOTICE)).not.toBeInTheDocument();

    server.use(http.post(`*${REFRESH_ENDPOINT}`, renewedSessionFor('PSICOLOGO')));
    act(() => {
      retries[0]?.();
    });

    await waitFor(() => {
      expect(sessionStore.accessToken()).not.toBe(session.accessToken);
    });
  });

  it('envía el token y cierra la sesión si el servidor lo rechaza con 401 y no se puede renovar', async () => {
    const session = storeSession('EMPLEADO');
    let receivedAuthorization: string | null = null;
    server.use(
      http.get('*/api/protegido', ({ request: incoming }) => {
        receivedAuthorization = incoming.headers.get('Authorization');
        return HttpResponse.json({ message: 'Token revocado' }, { status: 401 });
      }),
    );
    await renderRoute(ROLE_HOME_PATH.EMPLEADO);

    await act(async () => {
      await request('/api/protegido').catch(() => undefined);
    });

    expect(receivedAuthorization).toBe(`Bearer ${session.accessToken}`);
    expect(await screen.findByText(EXPIRED_NOTICE)).toBeInTheDocument();
  });
});

describe('conexión en tiempo real de la sesión', () => {
  function connectionSpy() {
    const created: { token: string; credentials: RealtimeCredentials | undefined }[] = [];
    return {
      created,
      factory: (token: string, credentials?: RealtimeCredentials) => {
        created.push({ token, credentials });
        return createMockRealtimeClient(token);
      },
    };
  }

  it('renovar el token no abre otra conexión; la reconexión usará el último', async () => {
    const { created, factory } = connectionSpy();
    server.use(http.post(`*${REFRESH_ENDPOINT}`, renewedSessionFor('PSICOLOGO')));
    const session = storeSession('PSICOLOGO', { expiresInMs: 50 });
    await renderRoute(ROLE_HOME_PATH.PSICOLOGO, factory);

    await waitFor(() => {
      expect(sessionStore.accessToken()).not.toBe(session.accessToken);
    });

    expect(created).toHaveLength(1);
    expect(created[0]?.token).toBe(session.accessToken);
    expect(created[0]?.credentials?.currentToken()).toBe(sessionStore.accessToken());
  });

  it('si el servidor rechaza la conexión y la sesión fue revocada, la sesión termina', async () => {
    const { created, factory } = connectionSpy();
    storeSession('EMPLEADO');
    const { router } = await renderRoute(ROLE_HOME_PATH.EMPLEADO, factory);

    act(() => {
      created[0]?.credentials?.onRejected();
    });

    expect(await screen.findByText(EXPIRED_NOTICE)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('otra persona que inicia sesión abre su propia conexión', async () => {
    const { created, factory } = connectionSpy();
    storeSession('EMPLEADO');
    const { user } = await renderRoute(ROLE_HOME_PATH.EMPLEADO, factory);

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await loginAs(user, seedUser('ADMIN').email);

    await waitFor(() => {
      expect(created).toHaveLength(2);
    });
  });
});

describe('varias pestañas', () => {
  it('cuando otra pestaña cierra la sesión, esta también', async () => {
    const tab = otherTab();
    storeSession('ADMIN');
    const { router } = await renderRoute(ROLE_HOME_PATH.ADMIN);

    tab.say({ type: 'ended', expired: false });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
    expect(screen.queryByText(EXPIRED_NOTICE)).not.toBeInTheDocument();
  });

  it('cuando la sesión venció en otra pestaña, esta también lo avisa', async () => {
    const tab = otherTab();
    storeSession('ADMIN');
    await renderRoute(ROLE_HOME_PATH.ADMIN);

    tab.say({ type: 'ended', expired: true });

    expect(await screen.findByText(EXPIRED_NOTICE)).toBeInTheDocument();
  });

  it('cuando otra pestaña inicia sesión, esta la recupera con la misma cookie', async () => {
    const tab = otherTab();
    const { router } = await renderRoute('/login');
    await initialRestoreFinished();

    startRefreshFamily(seedUser('ADMIN').id, false);
    tab.say({ type: 'started' });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(ROLE_HOME_PATH.ADMIN);
    });
  });

  it('si no logra recuperarla, sigue en el login sin avisar nada', async () => {
    const tab = otherTab();
    const { router } = await renderRoute('/login');
    await initialRestoreFinished();
    let answered = false;
    server.use(
      http.post(`*${REFRESH_ENDPOINT}`, () => {
        answered = true;
        return new HttpResponse(null, { status: 401 });
      }),
    );

    tab.say({ type: 'started' });

    await waitFor(() => {
      expect(answered).toBe(true);
    });
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.queryByText(EXPIRED_NOTICE)).not.toBeInTheDocument();
  });

  it('al iniciar sesión avisa a las demás pestañas', async () => {
    const tab = otherTab();
    const { user } = await renderRoute('/login');

    await loginAs(user, seedUser('EMPLEADO').email);

    await waitFor(() => {
      expect(tab.received).toEqual([{ type: 'started' }]);
    });
  });
});
