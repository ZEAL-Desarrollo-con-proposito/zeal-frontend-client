import type { RouteObject } from 'react-router';
import { MICROSOFT_SIMULATOR_PATH } from './handlers';
import { MicrosoftSimulatorPage } from './MicrosoftSimulatorPage';

/** Rutas que solo existen con el simulador: la app de producción nunca las incluye. */
export const microsoftSimulatorRoutes: RouteObject[] = [
  { path: MICROSOFT_SIMULATOR_PATH, element: <MicrosoftSimulatorPage /> },
];
