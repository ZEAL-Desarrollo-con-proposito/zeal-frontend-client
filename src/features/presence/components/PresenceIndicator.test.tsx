import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PresenceIndicator } from './PresenceIndicator';

describe('PresenceIndicator', () => {
  it('no dice nada mientras no se sabe si la otra persona está conectada', () => {
    const { container } = render(<PresenceIndicator status={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('anuncia que está en línea con texto además del color', () => {
    render(<PresenceIndicator status="online" />);

    const indicador = screen.getByRole('status');
    expect(indicador).toHaveTextContent('En línea');
    expect(indicador).toHaveAttribute('data-status', 'online');
  });

  it('anuncia que está desconectada también con texto, no solo con el color', () => {
    render(<PresenceIndicator status="offline" />);

    const indicador = screen.getByRole('status');
    expect(indicador).toHaveTextContent('Desconectado');
    expect(indicador).toHaveAttribute('data-status', 'offline');
  });
});
