import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('arranca en el navegador mostrando el inicio de sesión', async () => {
    render(<App />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ingresa a ZEAL' }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
  });
});
