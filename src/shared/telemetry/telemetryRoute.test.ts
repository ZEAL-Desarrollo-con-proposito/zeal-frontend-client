import { afterEach, describe, expect, it } from 'vitest';
import { registerTelemetryRoutes, telemetryRoute } from './telemetryRoute';

const PATTERNS = [
  '/',
  '/login',
  '/empleado/mis-citas',
  '/empleado/proyectos',
  '/empleado/proyectos/:projectId',
  '/empleado/bienestar/psicologos/:psychologistId',
  '/admin/talleres/sala/:workshopId',
  '/a/b/c/d/e/f',
];

describe('telemetryRoute', () => {
  afterEach(() => {
    registerTelemetryRoutes([]);
  });

  it('sin rutas registradas no reporta ninguna', () => {
    expect(telemetryRoute('/empleado/mis-citas')).toBeUndefined();
  });

  describe('con las rutas de la aplicación', () => {
    it.each([
      ['/empleado/mis-citas', '/empleado/mis-citas'],
      ['/empleado/mis-citas/', '/empleado/mis-citas'],
      ['/login', '/login'],
      ['/empleado/proyectos', '/empleado/proyectos'],
      ['/empleado/bienestar/psicologos/usr-001', '/empleado/bienestar/psicologos'],
      ['/admin/talleres/sala/550e8400-e29b-41d4-a716-446655440000', '/admin/talleres/sala'],
    ])('%s se reporta como %s', (pathname, expected) => {
      registerTelemetryRoutes(PATTERNS);
      expect(telemetryRoute(pathname)).toBe(expected);
    });

    it('un identificador con forma de ruta (solo letras y guiones) tampoco sale del navegador', () => {
      registerTelemetryRoutes(PATTERNS);

      expect(telemetryRoute('/empleado/proyectos/proyecto-observabilidad')).toBe(
        '/empleado/proyectos',
      );
      expect(telemetryRoute('/empleado/bienestar/psicologos/laura-gomez')).toBe(
        '/empleado/bienestar/psicologos',
      );
    });

    it('una ruta que no existe en la aplicación no se reporta', () => {
      registerTelemetryRoutes(PATTERNS);

      expect(telemetryRoute('/empleado/laura-gomez/historial')).toBeUndefined();
      expect(telemetryRoute('/empleado/mis-citas/otra-cosa')).toBeUndefined();
    });

    it('la ruta reportada es la del patrón, aunque la barra de direcciones tenga otras mayúsculas', () => {
      registerTelemetryRoutes(PATTERNS);

      expect(telemetryRoute('/Empleado/MIS-CITAS')).toBe('/empleado/mis-citas');
    });

    it('nunca envía más de cuatro segmentos', () => {
      registerTelemetryRoutes(PATTERNS);

      expect(telemetryRoute('/a/b/c/d/e/f')).toBe('/a/b/c/d');
    });

    it('la raíz no tiene segmentos y no se reporta', () => {
      registerTelemetryRoutes(PATTERNS);

      expect(telemetryRoute('/')).toBeUndefined();
    });

    it('registrar de nuevo reemplaza las rutas anteriores', () => {
      registerTelemetryRoutes(PATTERNS);
      registerTelemetryRoutes(['/login']);

      expect(telemetryRoute('/empleado/mis-citas')).toBeUndefined();
      expect(telemetryRoute('/login')).toBe('/login');
    });
  });
});
