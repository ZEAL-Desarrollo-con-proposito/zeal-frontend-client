import { describe, expect, it, vi } from 'vitest';
import { buildSession } from '@/test/credentials';
import { SESSION_STORAGE_KEY, sessionStore } from './sessionStore';

describe('sessionStore', () => {
  it('guarda en sessionStorage sin "Recordarme" y en localStorage con "Recordarme"', () => {
    const session = buildSession('EMPLEADO');

    sessionStore.save(session, false);
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();

    sessionStore.save(session, true);
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull();
    expect(sessionStore.load()).toEqual(session);
  });

  it('descarta y borra una sesión vencida', () => {
    const session = buildSession('ADMIN', 1000);
    sessionStore.save(session, true);

    expect(sessionStore.load(session.expiresAt)).toBeNull();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('descarta una sesión alterada', () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ accessToken: 'x', user: {} }));
    localStorage.setItem(SESSION_STORAGE_KEY, '{no es json');

    expect(sessionStore.load()).toBeNull();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('sigue funcionando si el navegador bloquea el almacenamiento', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Bloqueado', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('Bloqueado', 'SecurityError');
    });

    expect(() => {
      sessionStore.save(buildSession('EMPLEADO'), true);
    }).not.toThrow();
    expect(() => {
      sessionStore.clear();
    }).not.toThrow();
    expect(sessionStore.load()).toBeNull();
  });
});
