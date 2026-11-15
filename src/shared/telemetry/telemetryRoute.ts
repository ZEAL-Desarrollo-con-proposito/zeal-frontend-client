import { matchPath } from 'react-router';

/** Un segmento del contrato: solo minúsculas y guiones, sin identificadores. */
const VALID_SEGMENT = /^[a-z-]{1,30}$/;

/** Máximo de segmentos que acepta el backend. */
const MAX_SEGMENTS = 4;

/** Patrones de las rutas que existen en la aplicación, p. ej. `/empleado/proyectos/:projectId`. */
let knownPatterns: readonly string[] = [];

/**
 * Registra los patrones de ruta reales de la aplicación (los declara quien conoce el enrutador:
 * `shared` no depende de `app`). Reemplaza los anteriores.
 */
export function registerTelemetryRoutes(patterns: readonly string[]): void {
  knownPatterns = [...new Set(patterns)];
}

/** Del patrón a la ruta del contrato: solo sus segmentos fijos; los parámetros desaparecen. */
function contractRoute(pattern: string): string | undefined {
  const segments = pattern
    .split('/')
    .filter((segment) => VALID_SEGMENT.test(segment))
    .slice(0, MAX_SEGMENTS);

  return segments.length === 0 ? undefined : `/${segments.join('/')}`;
}

/**
 * Ruta del SPA lista para `POST /api/telemetria`. Solo se reporta una ruta que coincide con un
 * patrón conocido, y se reporta el patrón, nunca lo que la persona tiene en la barra de
 * direcciones: un identificador (`/proyectos/proyecto-observabilidad`) o cualquier texto ajeno a
 * las rutas de la aplicación jamás sale del navegador. Sin coincidencia, no hay ruta.
 */
export function telemetryRoute(pathname: string): string | undefined {
  const pattern = knownPatterns.find((known) => matchPath({ path: known, end: true }, pathname));

  return pattern === undefined ? undefined : contractRoute(pattern);
}
