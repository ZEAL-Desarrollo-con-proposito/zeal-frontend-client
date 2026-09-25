import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Role } from '@/features/auth/model/session';
import { storeSession } from '@/test/credentials';
import { renderRoute } from '@/test/renderRoute';
import { NAVIGATION, ROLE_PROFILE } from '../navigation';
import { ROLE_HOME_PATH } from '../paths';

function quickAccess() {
  return within(screen.getByRole('region', { name: 'Accesos rápidos' }));
}

describe('Pantalla de llegada', () => {
  it.each<[Role, string]>([
    ['EMPLEADO', 'Hola, David'],
    ['ADMIN', 'Hola, Talento'],
  ])('da la bienvenida a %s con su propósito y su garantía de privacidad', (role, greeting) => {
    storeSession(role);
    renderRoute(ROLE_HOME_PATH[role]);

    const hero = within(screen.getByRole('region', { name: greeting }));
    expect(hero.getByText(ROLE_PROFILE[role].welcome)).toBeInTheDocument();
    expect(hero.getByText(ROLE_PROFILE[role].privacyNote)).toBeInTheDocument();
  });

  it('ofrece un acceso rápido a cada sección del rol, salvo la pantalla actual', () => {
    storeSession('EMPLEADO');
    renderRoute(ROLE_HOME_PATH.EMPLEADO);

    const sections = NAVIGATION.EMPLEADO.slice(1);
    const links = quickAccess().getAllByRole('link');
    expect(links).toHaveLength(sections.length);
    for (const [index, section] of sections.entries()) {
      expect(links[index]).toHaveAttribute('href', section.path);
      expect(links[index]).toHaveTextContent(section.description);
    }
  });

  it('lleva a la sección elegida desde su acceso rápido', async () => {
    storeSession('EMPLEADO');
    const { router, user } = renderRoute(ROLE_HOME_PATH.EMPLEADO);

    await user.click(quickAccess().getByRole('link', { name: /Mis citas/ }));

    expect(router.state.location.pathname).toBe('/empleado/mis-citas');
  });
});
