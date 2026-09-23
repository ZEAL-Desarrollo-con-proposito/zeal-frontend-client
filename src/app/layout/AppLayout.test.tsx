import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Role } from '@/features/auth/model/session';
import { storeSession } from '@/test/credentials';
import { renderRoute } from '@/test/renderRoute';
import { NAVIGATION } from '../navigation';
import { ROLE_HOME_PATH } from '../paths';

function desktopSidebar() {
  return within(screen.getByRole('complementary', { name: 'Barra lateral' }));
}

function renderAs(role: Role, path: string = ROLE_HOME_PATH[role]) {
  storeSession(role);
  return renderRoute(path);
}

describe('Layout base con menú por rol', () => {
  it.each<[Role, string[], string]>([
    [
      'EMPLEADO',
      ['Inicio', 'Bienestar', 'Mis citas', 'Talleres', 'Proyectos', 'ZEAL Path', 'Mensajes'],
      'Nexura S.A.S. · Empleado',
    ],
    [
      'PSICOLOGO',
      ['Mi agenda', 'Pacientes', 'Mensajes', 'Talleres', 'Disponibilidad', 'Resumen'],
      'ZEAL · Psicólogo/a',
    ],
    [
      'ADMIN',
      ['Panel', 'Empleados', 'Proyectos', 'Talleres', 'Reportes', 'Organización'],
      'Nexura S.A.S. · Admin',
    ],
  ])('muestra el menú de %s con su pantalla de llegada activa', (role, labels, detail) => {
    renderAs(role);
    const sidebar = desktopSidebar();

    const links = sidebar.getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(labels);
    expect(links[0]).toHaveAttribute('aria-current', 'page');
    expect(sidebar.getByText(detail)).toBeInTheDocument();
  });

  it('navega entre secciones y mueve el indicador activo', async () => {
    const { router, user } = renderAs('EMPLEADO');
    const sidebar = desktopSidebar();

    await user.click(sidebar.getByRole('link', { name: 'Mis citas' }));

    expect(router.state.location.pathname).toBe('/empleado/mis-citas');
    expect(screen.getByRole('heading', { level: 1, name: 'Mis citas' })).toBeInTheDocument();
    expect(sidebar.getByRole('link', { name: 'Mis citas' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(sidebar.getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current');
  });

  it('muestra la identidad del usuario y un enlace para saltar al contenido', () => {
    renderAs('PSICOLOGO');

    expect(screen.getAllByRole('img', { name: 'Laura Martínez' })).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Saltar al contenido' })).toHaveAttribute(
      'href',
      '#contenido',
    );
    expect(screen.getByRole('main')).toHaveAttribute('id', 'contenido');
  });

  describe('menú móvil', () => {
    it('se abre, enfoca su botón de cierre y se cierra con Escape devolviendo el foco', async () => {
      const { user } = renderAs('ADMIN');
      const menuButton = screen.getByRole('button', { name: 'Abrir menú' });

      await user.click(menuButton);

      const dialog = screen.getByRole('dialog', { name: 'Menú' });
      expect(menuButton).toHaveAttribute('aria-expanded', 'true');
      expect(within(dialog).getByRole('button', { name: 'Cerrar menú' })).toHaveFocus();

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      expect(menuButton).toHaveFocus();
      expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('ignora otras teclas y se cierra con el botón o tocando el fondo', async () => {
      const { user } = renderAs('ADMIN');

      await user.click(screen.getByRole('button', { name: 'Abrir menú' }));
      await user.keyboard('{Shift}');
      const dialog = screen.getByRole('dialog', { name: 'Menú' });
      await user.click(within(dialog).getByRole('button', { name: 'Cerrar menú' }));
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Abrir menú' }));
      const backdrop = screen
        .getAllByRole('button', { name: 'Cerrar menú' })
        .find((button) => !screen.getByRole('dialog').contains(button));
      if (backdrop === undefined) {
        throw new Error('No se encontró el fondo del menú');
      }
      await user.click(backdrop);
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it.each([
      ['se cierra al deslizarlo hacia la izquierda', [150, 90, 20], false],
      ['sigue abierto tras un arrastre corto', [196, 192, 190], true],
    ])('%s', async (_case, positions, staysOpen) => {
      const { user } = renderAs('EMPLEADO');
      await user.click(screen.getByRole('button', { name: 'Abrir menú' }));
      const dialog = screen.getByRole('dialog', { name: 'Menú' });
      const pointer = { pointerId: 1, pointerType: 'mouse', button: 0, isPrimary: true };

      fireEvent.pointerDown(dialog, { ...pointer, clientX: 200, clientY: 300 });
      for (const clientX of positions) {
        fireEvent.pointerMove(window, { ...pointer, clientX, clientY: 300 });
        // Motion procesa el movimiento en el siguiente frame de animación.
        await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));
      }
      fireEvent.pointerUp(window, { ...pointer, clientX: positions.at(-1), clientY: 300 });

      await waitFor(() => {
        expect(screen.queryByRole('dialog') !== null).toBe(staysOpen);
      });
    });

    it('se cierra al elegir una sección', async () => {
      const { router, user } = renderAs('EMPLEADO');

      await user.click(screen.getByRole('button', { name: 'Abrir menú' }));
      const dialog = screen.getByRole('dialog', { name: 'Menú' });
      await user.click(within(dialog).getByRole('link', { name: 'ZEAL Path' }));

      expect(router.state.location.pathname).toBe('/empleado/zeal-path');
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });
});

describe('NAVIGATION', () => {
  it.each<Role>(['EMPLEADO', 'PSICOLOGO', 'ADMIN'])(
    'el menú de %s empieza en su pantalla de llegada y no sale de su prefijo',
    (role) => {
      const [home, ...sections] = NAVIGATION[role];
      const base = ROLE_HOME_PATH[role].split('/')[1] ?? '';

      expect(home?.path).toBe(ROLE_HOME_PATH[role]);
      for (const { path } of sections) {
        expect(path.startsWith(`/${base}/`)).toBe(true);
      }
    },
  );
});
