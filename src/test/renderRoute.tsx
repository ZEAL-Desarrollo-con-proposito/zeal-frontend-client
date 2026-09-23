import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/routes';

/** Renderiza la aplicación completa en una ruta inicial, con un router en memoria. */
export function renderRoute(initialPath: string) {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  const user = userEvent.setup();
  render(<RouterProvider router={router} />);
  return { router, user };
}
