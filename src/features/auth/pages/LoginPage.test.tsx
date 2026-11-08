import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ROLE_HOME_PATH } from '@/app/paths';
import { server } from '@/mocks/server';
import { DEMO_PASSWORD, seedUser } from '@/test/credentials';
import { renderRoute } from '@/test/renderRoute';
import type { Role } from '../model/session';
import { LOGIN_ENDPOINT } from '../api/authApi';

function emailField() {
  return screen.getByLabelText('Correo corporativo');
}

function passwordField() {
  return screen.getByLabelText('Contraseña');
}

function submitButton() {
  return screen.getByRole('button', { name: 'Iniciar sesión' });
}

describe('Pantalla de inicio de sesión', () => {
  it.each<[Role, string]>([
    ['EMPLEADO', 'Hola, David'],
    ['PSICOLOGO', 'Mi agenda'],
    ['ADMIN', 'Hola, Talento'],
  ])('lleva al usuario %s a su pantalla de llegada', async (role, greeting) => {
    const { router, user } = await renderRoute('/login');

    await user.type(emailField(), `  ${seedUser(role).email.toUpperCase()} `);
    await user.type(passwordField(), DEMO_PASSWORD);
    await user.click(submitButton());

    expect(await screen.findByRole('heading', { name: greeting })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(ROLE_HOME_PATH[role]);
  });

  it('valida los campos obligatorios y enfoca el primero con error', async () => {
    const { user } = await renderRoute('/login');

    await user.click(submitButton());

    expect(screen.getByText('Ingresa tu correo corporativo')).toBeInTheDocument();
    expect(screen.getByText('Ingresa tu contraseña')).toBeInTheDocument();
    expect(emailField()).toHaveAttribute('aria-invalid', 'true');
    expect(emailField()).toHaveFocus();
  });

  it('rechaza un correo con formato inválido y enfoca la contraseña si solo ella falta', async () => {
    const { user } = await renderRoute('/login');

    await user.type(emailField(), 'correo-sin-dominio');
    await user.click(submitButton());
    expect(
      screen.getByText('Ingresa un correo válido, por ejemplo nombre@empresa.com'),
    ).toBeInTheDocument();

    await user.clear(emailField());
    await user.type(emailField(), seedUser('EMPLEADO').email);
    expect(emailField()).toHaveAttribute('aria-invalid', 'false');

    await user.click(submitButton());
    expect(passwordField()).toHaveFocus();
    expect(emailField()).not.toHaveAccessibleDescription();
    expect(passwordField()).toHaveAccessibleDescription('Ingresa tu contraseña');
  });

  it('bloquea el botón mientras la autenticación está en curso', async () => {
    let releaseResponse: () => void = () => undefined;
    server.use(
      http.post(`*${LOGIN_ENDPOINT}`, async () => {
        await new Promise<void>((resolve) => {
          releaseResponse = resolve;
        });
        return HttpResponse.json({ status: 500, message: 'Error' }, { status: 500 });
      }),
    );
    const { user } = await renderRoute('/login');

    await user.type(emailField(), seedUser('EMPLEADO').email);
    await user.type(passwordField(), DEMO_PASSWORD);
    await user.click(submitButton());

    const busyButton = screen.getByRole('button', { name: 'Ingresando…' });
    expect(busyButton).toBeDisabled();
    expect(busyButton).toHaveAttribute('aria-busy', 'true');

    releaseResponse();
    expect(await screen.findByRole('button', { name: 'Iniciar sesión' })).toBeEnabled();
  });

  it('muestra el error de la respuesta 401, borra la contraseña y la enfoca', async () => {
    const { router, user } = await renderRoute('/login');
    const email = seedUser('EMPLEADO').email;

    await user.type(emailField(), email);
    await user.type(passwordField(), 'contraseña-equivocada');
    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos');
    expect(passwordField()).toHaveValue('');
    // El foco llega en el efecto posterior al render del error.
    await waitFor(() => {
      expect(passwordField()).toHaveFocus();
    });
    expect(emailField()).toHaveValue(email);
    expect(router.state.location.pathname).toBe('/login');
  });

  it('vuelve a mostrar el error en cada intento fallido y lo oculta al corregir', async () => {
    const { user } = await renderRoute('/login');

    await user.type(emailField(), seedUser('EMPLEADO').email);
    await user.type(passwordField(), 'primer-intento');
    await user.click(submitButton());
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await user.type(passwordField(), 'segundo-intento');
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    await user.click(submitButton());
    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos');
  });

  it.each([
    [
      'sin conexión',
      () => HttpResponse.error(),
      'No pudimos conectar con ZEAL. Revisa tu conexión e intenta de nuevo.',
    ],
    [
      'con el servidor caído',
      () => new HttpResponse(null, { status: 503 }),
      'ZEAL no está disponible en este momento. Intenta de nuevo en unos minutos.',
    ],
  ])('explica el fallo %s y conserva la contraseña', async (_case, resolver, message) => {
    server.use(http.post(`*${LOGIN_ENDPOINT}`, resolver));
    const { user } = await renderRoute('/login');

    await user.type(emailField(), seedUser('EMPLEADO').email);
    await user.type(passwordField(), DEMO_PASSWORD);
    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(passwordField()).toHaveValue(DEMO_PASSWORD);
  });

  it('permite marcar "Recordarme"', async () => {
    const { user } = await renderRoute('/login');
    const remember = screen.getByRole('checkbox', { name: 'Recordarme' });

    await user.click(remember);

    expect(remember).toBeChecked();
  });

  it('explica que la recuperación de contraseña y el SSO no hacen parte del MVP', async () => {
    const { user } = await renderRoute('/login');

    await user.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));
    expect(screen.getByRole('status')).toHaveTextContent('recuperación de contraseña');

    await user.click(screen.getByRole('button', { name: 'Continuar con SSO empresarial' }));
    expect(screen.getByRole('status')).toHaveTextContent('SSO empresarial');
  });
});
