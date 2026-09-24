import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { storeSession } from '@/test/credentials';
import { renderRoute } from '@/test/renderRoute';
import { ROLE_HOME_PATH } from '../paths';

describe('Sección aún sin pantalla', () => {
  it('explica qué contendrá la sección y ofrece volver al inicio', async () => {
    storeSession('ADMIN');
    const { router, user } = renderRoute('/admin/reportes');

    expect(screen.getByRole('heading', { level: 1, name: 'Reportes' })).toBeInTheDocument();
    expect(
      screen.getByText('Reportes agregados de la organización, nunca individuales.'),
    ).toBeInTheDocument();
    expect(screen.getByText('En construcción')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Volver al inicio' }));

    expect(router.state.location.pathname).toBe(ROLE_HOME_PATH.ADMIN);
  });
});
