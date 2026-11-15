import { afterEach, describe, expect, it } from 'vitest';
import { registerTelemetryRoutes, telemetryRoute } from '@/shared/telemetry/telemetryRoute';
import { NAVIGATION } from './navigation';
import { appRoutePatterns, registerAppTelemetryRoutes } from './telemetryRoutes';

/** El contrato de `POST /api/telemetria`: hasta cuatro segmentos de minúsculas y guiones. */
const CONTRACT_ROUTE = /^(\/[a-z-]{1,30}){1,4}$/;

describe('rutas de la telemetría', () => {
  afterEach(() => {
    registerTelemetryRoutes([]);
  });

  it('incluye cada sección del menú de cada rol', () => {
    const patterns = appRoutePatterns();
    for (const items of Object.values(NAVIGATION)) {
      for (const { path } of items) {
        expect(patterns).toContain(path);
      }
    }
  });

  it('cada ruta de la aplicación se reporta con una ruta válida del contrato, sin parámetros', () => {
    registerAppTelemetryRoutes();

    for (const pattern of appRoutePatterns().filter((path) => path !== '/')) {
      const concrete = pattern.replace(/:\w+/g, 'proyecto-observabilidad');
      const route = telemetryRoute(concrete);

      expect(route, concrete).toMatch(CONTRACT_ROUTE);
      expect(route, concrete).not.toContain('proyecto-observabilidad');
    }
  });

  it('las pantallas con identificador reportan solo su sección', () => {
    registerAppTelemetryRoutes();

    expect(telemetryRoute('/empleado/proyectos/proyecto-observabilidad')).toBe(
      '/empleado/proyectos',
    );
    expect(telemetryRoute('/empleado/talleres/sala/taller-impostor')).toBe(
      '/empleado/talleres/sala',
    );
    expect(telemetryRoute('/empleado/inicio')).toBe('/empleado/inicio');
  });
});
