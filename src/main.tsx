import '@fontsource/anton/400.css';
import '@fontsource/archivo/400.css';
import '@fontsource/archivo/500.css';
import '@fontsource/archivo/600.css';
import '@fontsource/archivo/700.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { RouteObject } from 'react-router';
import { App } from './app/App';
import { reloadOnStaleBuild } from './app/staleBuild';
import { resolveRealtimeUrl } from './shared/config/realtimeUrl';
import type { RealtimeClientFactory } from './shared/realtime/realtimeClient';
import { createStompRealtimeClient } from './shared/realtime/stompRealtimeClient';

const isApiMockingEnabled = import.meta.env.DEV && import.meta.env.VITE_API_MOCKING === 'enabled';

interface BackendAdapters {
  realtimeClientFactory: RealtimeClientFactory;
  extraRoutes: readonly RouteObject[];
}

/**
 * Composición del backend: en desarrollo con simulador se usan MSW, el tiempo real simulado y el
 * selector de cuentas que reemplaza a Microsoft (el build de producción los elimina); en otro
 * caso, el API Gateway y el Real-Time Gateway.
 */
async function createBackendAdapters(): Promise<BackendAdapters> {
  if (isApiMockingEnabled) {
    const [
      { worker },
      { createMockRealtimeClient },
      { handleChatMessage },
      { microsoftSimulatorRoutes },
    ] = await Promise.all([
      import('./mocks/browser'),
      import('./mocks/realtime'),
      import('./mocks/wellbeing/chatHandlers'),
      import('./mocks/microsoft/simulatorRoutes'),
    ]);
    await worker.start({ onUnhandledRequest: 'bypass' });
    return {
      // El cliente solo envía mensajes de chat; el video va por el servidor de medios (ADR-14).
      realtimeClientFactory: (accessToken) =>
        createMockRealtimeClient(accessToken, handleChatMessage),
      extraRoutes: microsoftSimulatorRoutes,
    };
  }
  const realtimeUrl = resolveRealtimeUrl(import.meta.env.VITE_REALTIME_URL);
  return {
    realtimeClientFactory: (accessToken, credentials) =>
      createStompRealtimeClient(realtimeUrl, accessToken, credentials),
    extraRoutes: [],
  };
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('No se encontró el elemento raíz #root en index.html');
}

reloadOnStaleBuild(window);

const { realtimeClientFactory, extraRoutes } = await createBackendAdapters();

createRoot(rootElement).render(
  <StrictMode>
    <App realtimeClientFactory={realtimeClientFactory} extraRoutes={extraRoutes} />
  </StrictMode>,
);
