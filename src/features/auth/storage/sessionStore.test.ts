import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSession } from '@/test/credentials';
import { forgetLegacySession, sessionStore } from './sessionStore';

describe('sessionStore', () => {
  afterEach(() => {
    sessionStore.clear();
  });

  it('guarda la sesión solo en memoria: nada queda en el almacenamiento del navegador', () => {
    const session = buildSession('EMPLEADO');

    sessionStore.save(session);

    expect(sessionStore.load()).toEqual(session);
    expect(sessionStore.accessToken()).toBe(session.accessToken);
    expect(localStorage).toHaveLength(0);
    expect(sessionStorage).toHaveLength(0);
  });

  it('no entrega una sesión vencida, aunque conserva su token para la reconexión', () => {
    const session = buildSession('EMPLEADO', 60_000);
    sessionStore.save(session);

    expect(sessionStore.load(session.expiresAt)).toBeNull();
    expect(sessionStore.accessToken()).toBe(session.accessToken);
  });

  it('sin sesión no hay nada que entregar', () => {
    sessionStore.save(buildSession('ADMIN'));

    sessionStore.clear();

    expect(sessionStore.load()).toBeNull();
    expect(sessionStore.accessToken()).toBeNull();
  });
});

describe('forgetLegacySession', () => {
  it('borra el token que una versión anterior dejó guardado en el navegador', () => {
    localStorage.setItem('zeal.session', 'token-viejo');
    sessionStorage.setItem('zeal.session', 'token-viejo');
    localStorage.setItem('otra-clave', 'se-queda');

    forgetLegacySession();

    expect(localStorage.getItem('zeal.session')).toBeNull();
    expect(sessionStorage.getItem('zeal.session')).toBeNull();
    expect(localStorage.getItem('otra-clave')).toBe('se-queda');
  });

  it('no falla si el navegador bloquea el almacenamiento', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('Bloqueado', 'SecurityError');
    });

    expect(() => {
      forgetLegacySession();
    }).not.toThrow();
  });
});
