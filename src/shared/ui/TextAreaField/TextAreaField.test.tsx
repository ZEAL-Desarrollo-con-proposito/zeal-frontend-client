import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextAreaField } from './TextAreaField';

describe('TextAreaField', () => {
  it('enlaza la pista y el error a la descripción accesible del campo', () => {
    render(
      <TextAreaField
        label="Descripción"
        hint="Separa los párrafos con una línea en blanco"
        error="La descripción debe tener al menos 20 caracteres"
        rows={5}
      />,
    );

    const field = screen.getByLabelText('Descripción');
    expect(field).toHaveAccessibleDescription(/línea en blanco/);
    expect(field).toHaveAccessibleDescription(/al menos 20 caracteres/);
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Separa los párrafos con una línea en blanco')).toBeInTheDocument();
    expect(
      screen.getByText('La descripción debe tener al menos 20 caracteres'),
    ).toBeInTheDocument();
  });

  it('sin pista ni error no describe el campo ni lo marca inválido', () => {
    render(<TextAreaField label="Requisitos (opcional)" rows={3} />);

    const field = screen.getByLabelText('Requisitos (opcional)');
    expect(field).not.toHaveAttribute('aria-describedby');
    expect(field).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByText(/línea en blanco/)).not.toBeInTheDocument();
  });
});
