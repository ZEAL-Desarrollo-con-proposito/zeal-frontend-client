import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { expect } from 'vitest';
import { SECTIONS } from '@/app/lazyPages';
import { ROLE_BASE_PATH } from '@/app/paths';
import { routes } from '@/app/routes';
import { microsoftSimulatorRoutes } from '@/mocks/microsoft/simulatorRoutes';
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

type SectionName = keyof typeof SECTIONS;

const SECTION_OF_PREFIX: readonly [string, SectionName][] = [
  [ROLE_BASE_PATH.EMPLEADO, 'employee'],
  [ROLE_BASE_PATH.PSICOLOGO, 'psychologist'],
  [ROLE_BASE_PATH.ADMIN, 'admin'],
];

const sectionsLoaded = new Map<SectionName, Promise<unknown>>();

/** Solo la sección que necesita la ruta inicial: cargar las cuatro encarece el primer test. */
function sectionOfPath(path: string): SectionName | null {
  const { pathname } = new URL(path, 'http://localhost');
  if (pathname.includes('/sala/')) {
    return 'rooms';
  }
  const match = SECTION_OF_PREFIX.find(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return match?.[1] ?? null;
}

async function loadSection(path: string): Promise<void> {
  const section = sectionOfPath(path);
  if (section === null) {
    return;
  }
  let loading = sectionsLoaded.get(section);
  if (loading === undefined) {
    loading = SECTIONS[section]();
    sectionsLoaded.set(section, loading);
  }
  await loading;
}

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
  // Como en el simulador: el selector de cuentas reemplaza a Microsoft.
  const router = createMemoryRouter([...microsoftSimulatorRoutes, ...routes], {
    initialEntries: [initialPath],
  });
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
 * Como `renderApp`, pero espera a que la pantalla esté a la vista. La sección que necesita la ruta
 * se descarga una vez por archivo de pruebas, antes de la primera, para que su carga no cuente
 * dentro de la espera de cada prueba.
 */
export async function renderRoute(
  initialPath: string,
  realtimeClientFactory?: RealtimeClientFactory,
) {
  await loadSection(initialPath);
  const view = renderApp(initialPath, realtimeClientFactory);
  await waitFor(() => {
    expect(screen.queryByText(SECTION_LOADING)).not.toBeInTheDocument();
  });
  return view;
}
