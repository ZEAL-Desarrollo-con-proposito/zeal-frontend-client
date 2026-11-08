import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderRoute } from '@/test/renderRoute';
import { PATHS } from './paths';

describe('enrutamiento de la aplicación', () => {
  it('redirige la raíz al inicio de sesión', async () => {
    const { router } = await renderRoute(PATHS.root);

    expect(router.state.location.pathname).toBe(PATHS.login);
    expect(screen.getByRole('heading', { level: 1, name: 'Ingresa a ZEAL' })).toBeInTheDocument();
  });

  it('muestra el panel de marca en el inicio de sesión', async () => {
    await renderRoute(PATHS.login);

    const hero = screen.getByRole('complementary', { name: 'Sobre ZEAL' });
    expect(hero).toHaveTextContent('Cuidado de la salud mental en el trabajo');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('muestra la página 404 para una ruta desconocida y permite volver al inicio', async () => {
    const { router, user } = await renderRoute('/ruta-que-no-existe');

    expect(screen.getByRole('heading', { name: 'No encontramos esta página' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Volver al inicio' }));

    expect(router.state.location.pathname).toBe(PATHS.login);
  });
});
