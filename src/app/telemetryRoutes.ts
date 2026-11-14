import { registerTelemetryRoutes } from '@/shared/telemetry/telemetryRoute';
import { NAVIGATION } from './navigation';
import { ADMIN_PATHS, EMPLOYEE_PATHS, PATHS, PSYCHOLOGIST_PATHS, ROLE_HOME_PATH } from './paths';

/** Patrones de todas las rutas de la aplicación: la fuente de lo que la telemetría puede reportar. */
export function appRoutePatterns(): string[] {
  return [
    ...Object.values(PATHS),
    ...Object.values(ROLE_HOME_PATH),
    ...Object.values(PSYCHOLOGIST_PATHS),
    ...Object.values(ADMIN_PATHS),
    ...Object.values(EMPLOYEE_PATHS),
    ...Object.values(NAVIGATION).flatMap((items) => items.map(({ path }) => path)),
  ];
}

/** Da a la telemetría las rutas reales de la aplicación (los errores y las vistas las usan). */
export function registerAppTelemetryRoutes(): void {
  registerTelemetryRoutes(appRoutePatterns());
}
