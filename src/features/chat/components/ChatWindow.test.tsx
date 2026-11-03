import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { freezeTime } from '@/test/clock';
import { setupUser } from '@/test/user';
import type { ChatMessage } from '../model/chatMessage';
import type { ChatPeer } from '../model/chatPeer';
import { ChatWindow } from './ChatWindow';

type WindowProps = Parameters<typeof ChatWindow>[0];

const LAURA: ChatPeer = {
  id: 'usr-psicologo-001',
  fullName: 'Laura Martínez',
  title: 'Psicóloga clínica',
};
const DAVID: ChatPeer = { id: 'usr-empleado-001', fullName: 'David Cajamarca' };
const CONVERSATION = 'usr-empleado-001:usr-psicologo-001';

function mensaje(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'mensaje-1',
    conversationId: CONVERSATION,
    senderId: 'usr-psicologo-001',
    senderName: 'Laura Martínez',
    text: '¿Cómo amaneciste?',
    sentAt: new Date(2026, 8, 23, 9, 15).toISOString(),
    ...overrides,
  };
}

function renderWindow(overrides: Partial<WindowProps> = {}) {
  const props: WindowProps = {
    peer: LAURA,
    currentUserId: 'usr-empleado-001',
    messages: [],
    onSend: vi.fn(),
    historyStatus: 'ready',
    onRetryHistory: vi.fn(),
    connectionStatus: 'connected',
    ...overrides,
  };
  return { ...render(<ChatWindow {...props} />), props };
}

describe('ChatWindow', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('identifica a la otra persona con su nombre y su rol', () => {
    renderWindow();

    expect(screen.getByRole('region', { name: 'Chat con Laura Martínez' })).toBeInTheDocument();
    expect(screen.getByText('Laura Martínez')).toBeInTheDocument();
    expect(screen.getByText('Psicóloga clínica')).toBeInTheDocument();
  });

  it('con un empleado al otro lado no hay rol que mostrar', () => {
    renderWindow({ peer: DAVID });

    expect(screen.getByText('David Cajamarca')).toBeInTheDocument();
    expect(screen.queryByText('Psicóloga clínica')).not.toBeInTheDocument();
  });

  it('muestra los mensajes agrupados por día, distinguiendo los propios de los de la otra persona', () => {
    renderWindow({
      messages: [
        mensaje({
          id: 'm1',
          senderId: 'usr-empleado-001',
          senderName: 'David Cajamarca',
          text: 'Buenos días',
          sentAt: new Date(2026, 8, 23, 8, 5).toISOString(),
        }),
        mensaje(),
        mensaje({
          id: 'm3',
          senderId: 'usr-psicologo-001',
          text: 'Duerme bien',
          sentAt: new Date(2026, 8, 22, 18, 40).toISOString(),
        }),
      ],
    });

    const log = screen.getByRole('log', { name: 'Mensajes con Laura Martínez' });
    expect(within(log).getByText('Hoy')).toBeInTheDocument();
    expect(within(log).getByText('Ayer')).toBeInTheDocument();
    expect(within(log).getByText('Tú:')).toBeInTheDocument();
    expect(within(log).getAllByText('Laura Martínez:')).toHaveLength(2);
    expect(within(log).getByText('¿Cómo amaneciste?')).toBeInTheDocument();
    expect(within(log).getByText('8:05')).toBeInTheDocument();
  });

  it('mientras carga el historial avisa que está cargando', () => {
    renderWindow({ historyStatus: 'loading' });

    expect(screen.getByText('Cargando mensajes…')).toBeInTheDocument();
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
  });

  it('si el historial falla ofrece reintentar', async () => {
    const { props } = renderWindow({ historyStatus: 'error' });
    const user = setupUser();

    expect(screen.getByText('No pudimos cargar los mensajes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(props.onRetryHistory).toHaveBeenCalledTimes(1);
  });

  it('si el historial falla más tarde, avisa sin tapar lo que ya está en pantalla', async () => {
    const { props, rerender } = renderWindow({ messages: [mensaje()] });
    const user = setupUser();

    rerender(<ChatWindow {...props} historyStatus="loading" />);
    expect(screen.getByRole('log')).toBeInTheDocument();

    rerender(<ChatWindow {...props} historyStatus="error" />);
    const aviso = screen.getByRole('alert');
    expect(aviso).toHaveTextContent('No pudimos cargar los mensajes anteriores.');
    expect(screen.getByText('¿Cómo amaneciste?')).toBeInTheDocument();

    await user.click(within(aviso).getByRole('button', { name: 'Reintentar' }));
    expect(props.onRetryHistory).toHaveBeenCalledTimes(1);
  });

  it('una conversación vacía invita a escribir', () => {
    renderWindow();

    expect(screen.getByText('Aún no tienes mensajes con Laura Martínez')).toBeInTheDocument();
    expect(
      screen.getByText('Escríbele cuando quieras, sin esperar a tu próxima sesión.'),
    ).toBeInTheDocument();
  });

  it('sin conexión en tiempo real avisa y bloquea la escritura', () => {
    renderWindow({ connectionStatus: 'reconnecting' });

    expect(screen.getByRole('status')).toHaveTextContent('Conexión perdida. Reconectando…');
    expect(screen.getByPlaceholderText('Esperando conexión…')).toBeDisabled();
  });

  it('escribe lo que la persona envía', async () => {
    const { props } = renderWindow();
    const user = setupUser();

    await user.type(screen.getByRole('textbox', { name: 'Escribe un mensaje' }), 'hola');
    await user.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    expect(props.onSend).toHaveBeenCalledExactlyOnceWith('hola');
  });

  it('dice si la otra persona está en línea o desconectada', () => {
    const { rerender, props } = renderWindow({ peerStatus: 'online' });

    expect(screen.getByText('En línea')).toBeInTheDocument();

    rerender(<ChatWindow {...props} peerStatus="offline" />);

    expect(screen.getByText('Desconectado')).toBeInTheDocument();
  });

  it('mientras no se sabe la presencia no dice nada de ella', () => {
    renderWindow();

    expect(screen.queryByText('En línea')).not.toBeInTheDocument();
    expect(screen.queryByText('Desconectado')).not.toBeInTheDocument();
  });

  it('avisa que la otra persona está escribiendo y sigue suTecleo', async () => {
    const onTyping = vi.fn();
    renderWindow({ peerTyping: true, onTyping });
    const user = setupUser();

    expect(screen.getByText(/Laura Martínez está escribiendo/)).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Escribe un mensaje' }), 'hola');

    expect(onTyping).toHaveBeenLastCalledWith(true);
  });
});
