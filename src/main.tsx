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

/** El API local simulado solo existe en desarrollo: el build de producción lo elimina. */
async function enableApiMocking() {
  if (import.meta.env.DEV && import.meta.env.VITE_API_MOCKING === 'enabled') {
    const { worker } = await import('./mocks/browser');
    await worker.start({ onUnhandledRequest: 'bypass' });
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('No se encontró el elemento raíz #root en index.html');
}

await enableApiMocking();

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
