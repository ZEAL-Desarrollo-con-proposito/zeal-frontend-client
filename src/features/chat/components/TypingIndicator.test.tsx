import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TypingIndicator } from './TypingIndicator';

describe('TypingIndicator', () => {
  it('avisa que la otra persona está escribiendo, con puntos que no se anuncian', () => {
    render(<TypingIndicator peerName="Laura Martínez" />);

    const aviso = screen.getByRole('status');
    expect(aviso).toHaveTextContent('Laura Martínez está escribiendo');
    expect(aviso.querySelectorAll('[aria-hidden="true"] span')).toHaveLength(3);
  });
});
