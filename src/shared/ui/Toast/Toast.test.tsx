import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToastInput } from './toast';
import { MAX_VISIBLE_TOASTS, TOAST_DURATION_MS } from './toast';
import { ToastProvider } from './ToastProvider';
import { useToast } from './useToast';

function Trigger({ toast }: Readonly<{ toast: ToastInput }>) {
  const showToast = useToast();
  return (
    <button
      type="button"
      onClick={() => {
        showToast(toast);
      }}
    >
      Avisar
    </button>
  );
}

const CONFIRMED: ToastInput = {
  tone: 'success',
  title: 'Tu cita quedó confirmada',
  message: 'Laura Martínez · miércoles, 23 de septiembre de 10:00 a 10:50',
  action: { label: 'Ver mis citas', to: '/mis-citas' },
};

function renderWithToasts(toast: ToastInput = CONFIRMED) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Trigger toast={toast} />} />
          <Route path="/mis-citas" element={<p>Mis citas</p>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

function avisar() {
  fireEvent.click(screen.getByRole('button', { name: 'Avisar' }));
}

function toasts() {
  return within(screen.getByRole('region', { name: 'Avisos' })).queryAllByRole('listitem');
}

function firstToast(): HTMLElement {
  const [toast] = toasts();
  if (toast === undefined) {
    throw new Error('No hay avisos en pantalla');
  }
  return toast;
}

/**
 * Espera a que salgan los avisos cerrados: su animación de salida termina en el siguiente cuadro,
 * y en jsdom los cuadros dependen de setTimeout, así que se vuelve a los temporizadores reales.
 */
async function expectToastCount(count: number) {
  vi.useRealTimers();
  await waitFor(() => {
    expect(toasts()).toHaveLength(count);
  });
}

function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('Avisos emergentes', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('muestra el aviso en una región que anuncian los lectores de pantalla', () => {
    renderWithToasts();

    avisar();

    const region = screen.getByRole('region', { name: 'Avisos' });
    expect(region).toHaveAttribute('aria-live', 'polite');
    const toast = within(firstToast());
    expect(toast.getByText('Tu cita quedó confirmada')).toBeInTheDocument();
    expect(
      toast.getByText('Laura Martínez · miércoles, 23 de septiembre de 10:00 a 10:50'),
    ).toBeInTheDocument();
    expect(toast.getByText('Ahora')).toBeInTheDocument();
  });

  it('se cierra solo a los pocos segundos', async () => {
    renderWithToasts();
    avisar();

    wait(TOAST_DURATION_MS - 1);
    expect(toasts()).toHaveLength(1);
    wait(1);

    await expectToastCount(0);
  });

  it('no se cierra mientras el puntero está encima', async () => {
    renderWithToasts();
    avisar();
    const toast = firstToast();

    fireEvent.mouseEnter(toast);
    wait(TOAST_DURATION_MS * 2);
    expect(toasts()).toHaveLength(1);

    fireEvent.mouseLeave(toast);
    wait(TOAST_DURATION_MS);
    await expectToastCount(0);
  });

  it('no se cierra mientras el foco está dentro, aunque pase de un control a otro', async () => {
    renderWithToasts();
    avisar();
    const toast = within(firstToast());
    const close = toast.getByRole('button', { name: 'Cerrar aviso' });
    const action = toast.getByRole('link', { name: 'Ver mis citas' });

    fireEvent.focus(action);
    fireEvent.blur(action, { relatedTarget: close });
    fireEvent.focus(close);
    wait(TOAST_DURATION_MS * 2);
    expect(toasts()).toHaveLength(1);

    fireEvent.blur(close, { relatedTarget: document.body });
    wait(TOAST_DURATION_MS);
    await expectToastCount(0);
  });

  it('se cierra con su botón', async () => {
    renderWithToasts();
    avisar();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }));

    await expectToastCount(0);
  });

  it('su acción lleva a otra pantalla y lo cierra', async () => {
    renderWithToasts();
    avisar();

    fireEvent.click(screen.getByRole('link', { name: 'Ver mis citas' }));

    expect(screen.getByText('Mis citas')).toBeInTheDocument();
    await expectToastCount(0);
  });

  it(`muestra como máximo ${String(MAX_VISIBLE_TOASTS)} avisos: el más antiguo sale`, async () => {
    renderWithToasts({ title: 'Aviso', tone: 'info' });

    for (let count = 0; count <= MAX_VISIBLE_TOASTS; count += 1) {
      avisar();
    }

    await expectToastCount(MAX_VISIBLE_TOASTS);
  });

  it.each(['success', 'info', 'warning'] as const)('distingue el tono %s', (tone) => {
    renderWithToasts({ title: 'Aviso', tone });
    avisar();

    expect(firstToast()).toHaveAttribute('data-tone', tone);
  });

  it('es informativo por defecto y sin acción ni mensaje', () => {
    renderWithToasts({ title: 'Aviso' });
    avisar();

    const toast = firstToast();
    expect(toast).toHaveAttribute('data-tone', 'info');
    expect(within(toast).queryByRole('link')).not.toBeInTheDocument();
  });

  it('sin proveedor, pedir un aviso no falla', () => {
    render(<Trigger toast={CONFIRMED} />);

    expect(() => {
      avisar();
    }).not.toThrow();
  });
});
