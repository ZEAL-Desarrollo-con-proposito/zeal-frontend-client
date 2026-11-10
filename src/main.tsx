import '@fontsource/anton/400.css';
import '@fontsource/archivo/400.css';
import '@fontsource/archivo/500.css';
import '@fontsource/archivo/600.css';
import '@fontsource/archivo/700.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { resolveRealtimeUrl } from './shared/config/realtimeUrl';
import type { RealtimeClientFactory } from './shared/realtime/realtimeClient';
import { createStompRealtimeClient } from './shared/realtime/stompRealtimeClient';

const isApiMockingEnabled = import.meta.env.DEV && import.meta.env.VITE_API_MOCKING === 'enabled';

/**
 * Composición del backend: en desarrollo con simulador se usan MSW y el tiempo real simulado
 * (el build de producción los elimina); en otro caso, el API Gateway y el Real-Time Gateway.
 */
async function createBackendAdapters(): Promise<RealtimeClientFactory> {
  if (isApiMockingEnabled) {
    const [{ worker }, { createMockRealtimeClient }, { handleChatMessage }] = await Promise.all([
      import('./mocks/browser'),
      import('./mocks/realtime'),
      import('./mocks/wellbeing/chatHandlers'),
    ]);
    await worker.start({ onUnhandledRequest: 'bypass' });
    // El cliente solo envía mensajes de chat; el video va por el servidor de medios (ADR-14).
    return (accessToken) => createMockRealtimeClient(accessToken, handleChatMessage);
  }
  const realtimeUrl = resolveRealtimeUrl(import.meta.env.VITE_REALTIME_URL);
  return (accessToken, credentials) =>
    createStompRealtimeClient(realtimeUrl, accessToken, credentials);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('No se encontró el elemento raíz #root en index.html');
}

const realtimeClientFactory = await createBackendAdapters();

createRoot(rootElement).render(
  <StrictMode>
    <App realtimeClientFactory={realtimeClientFactory} />
  </StrictMode>,
);
