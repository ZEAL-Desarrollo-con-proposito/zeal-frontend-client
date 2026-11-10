import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { expect } from 'vitest';
import { SECTIONS } from '@/app/lazyPages';
import { routes } from '@/app/routes';
import { createMockRealtimeClient } from '@/mocks/realtime';
import { handleChatMessage } from '@/mocks/wellbeing/chatHandlers';
import type { RealtimeClientFactory } from '@/shared/realtime/realtimeClient';
import { RealtimeFactoryContext } from '@/shared/realtime/RealtimeContext';
import { trackSubscriptions } from './realtime';
import { setupUser } from './user';

/** El servidor simulado procesa lo que envía el cliente: hoy, solo los mensajes de chat. */
const onMockMessage = handleChatMessage;

/** Aviso de las pantallas que aún se descargan (HU-FE-24). */
const SECTION_LOADING = /^Cargando la (sección|pantalla)…$/;

let sectionsLoaded: Promise<unknown> | null = null;

/**
 * Renderiza la aplicación completa en una ruta inicial, con un router en memoria, sin esperar a las
 * pantallas que se cargan bajo demanda. `subscribedTo` espera a que la pantalla escuche un destino
 * antes de que la prueba publique en él.
 */
export function renderApp(
  initialPath: string,
  realtimeClientFactory: RealtimeClientFactory = (accessToken) =>
    createMockRealtimeClient(accessToken, onMockMessage),
) {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  const user = setupUser();
  const { factory, subscribedTo } = trackSubscriptions(realtimeClientFactory);
  const { unmount } = render(
    <RealtimeFactoryContext value={factory}>
      <RouterProvider router={router} />
    </RealtimeFactoryContext>,
  );
  return { router, user, unmount, subscribedTo };
}

/**
 * Como `renderApp`, pero espera a que la pantalla esté a la vista. Las secciones se descargan una
 * vez por archivo de pruebas, antes de la primera, para que su carga no cuente dentro de la espera
 * de cada prueba.
 */
export async function renderRoute(
  initialPath: string,
  realtimeClientFactory?: RealtimeClientFactory,
) {
  sectionsLoaded ??= Promise.all(Object.values(SECTIONS).map((load) => load()));
  await sectionsLoaded;
  const view = renderApp(initialPath, realtimeClientFactory);
  await waitFor(() => {
    expect(screen.queryByText(SECTION_LOADING)).not.toBeInTheDocument();
  });
  return view;
}
