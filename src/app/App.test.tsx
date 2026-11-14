import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createMockRealtimeClient } from '@/mocks/realtime';
import { telemetryRoute } from '@/shared/telemetry/telemetryRoute';
import { App } from './App';

describe('App', () => {
  it('arranca en el navegador mostrando el inicio de sesión', async () => {
    render(<App realtimeClientFactory={() => createMockRealtimeClient()} extraRoutes={[]} />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ingresa a ZEAL' }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
  });

  it('da a la telemetría las rutas reales de la aplicación al arrancar', () => {
    expect(telemetryRoute('/empleado/proyectos/proyecto-observabilidad')).toBe(
      '/empleado/proyectos',
    );
    expect(telemetryRoute('/ruta-que-no-existe')).toBeUndefined();
  });
});
