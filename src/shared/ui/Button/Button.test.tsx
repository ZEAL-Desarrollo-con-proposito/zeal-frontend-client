import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';
import { LinkButton } from './LinkButton';

describe('Button', () => {
  it('es un botón de tipo "button" por defecto y ejecuta la acción al pulsarlo', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Reservar sesión</Button>);

    const button = screen.getByRole('button', { name: 'Reservar sesión' });
    await userEvent.click(button);

    expect(button).toHaveAttribute('type', 'button');
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('acepta el tipo "submit", la variante de contorno y el ancho completo', () => {
    render(
      <Button type="submit" variant="outline" fullWidth className="extra">
        Enviar
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Enviar' });
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toHaveClass('extra');
  });

  it('no ejecuta la acción cuando está deshabilitado', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Cupos agotados
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Cupos agotados' });
    await userEvent.click(button);

    expect(button).toBeDisabled();
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('LinkButton', () => {
  it('navega a la ruta indicada', async () => {
    const router = createMemoryRouter(
      [
        { path: '/', element: <LinkButton to="/destino">Ir al destino</LinkButton> },
        {
          path: '/destino',
          element: (
            <LinkButton to="/" variant="outline">
              Volver
            </LinkButton>
          ),
        },
      ],
      { initialEntries: ['/'] },
    );
    render(<RouterProvider router={router} />);

    await userEvent.click(screen.getByRole('link', { name: 'Ir al destino' }));

    expect(router.state.location.pathname).toBe('/destino');
    expect(screen.getByRole('link', { name: 'Volver' })).toHaveAttribute('href', '/');
  });
});
