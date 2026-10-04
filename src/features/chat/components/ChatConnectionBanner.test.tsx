import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RealtimeStatus } from '@/shared/realtime/realtimeClient';
import { ChatConnectionBanner } from './ChatConnectionBanner';

describe('ChatConnectionBanner', () => {
  it('no dice nada cuando la conexión está bien', () => {
    const { container } = render(<ChatConnectionBanner status="connected" />);

    expect(container).toBeEmptyDOMElement();
  });

  it.each<[RealtimeStatus, string]>([
    ['connecting', 'Conectando…'],
    ['reconnecting', 'Conexión perdida. Reconectando…'],
    ['idle', 'Sin conexión en tiempo real.'],
  ])('interrumpe mientras la conexión está %s', (status, mensaje) => {
    render(<ChatConnectionBanner status={status} />);

    expect(screen.getByRole('status')).toHaveTextContent(mensaje);
    expect(screen.getByRole('status')).toHaveAttribute('data-status', status);
  });
});
