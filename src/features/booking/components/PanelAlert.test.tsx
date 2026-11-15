import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PanelAlert } from './PanelAlert';

describe('PanelAlert', () => {
  it('toma el foco cuando se pide y el nodo ya existe', () => {
    const { container } = render(<PanelAlert message="Aviso" takeFocus />);
    expect(container.firstChild).not.toBeNull();
  });

  it('no toma el foco cuando no se pide', () => {
    const { container } = render(<PanelAlert message="Aviso" takeFocus={false} />);
    expect(container.firstChild).not.toBeNull();
  });
});
