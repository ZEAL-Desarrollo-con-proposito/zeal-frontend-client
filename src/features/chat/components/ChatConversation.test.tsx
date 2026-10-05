import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMockRealtimeClient, publishToUser } from '@/mocks/realtime';
import { appendChatMessage } from '@/mocks/wellbeing/chatDb';
import { handleChatMessage } from '@/mocks/wellbeing/chatHandlers';
import { configureHttpAuth } from '@/shared/api/httpClient';
import { RealtimeFactoryContext } from '@/shared/realtime/RealtimeContext';
import { RealtimeProvider } from '@/shared/realtime/RealtimeProvider';
import { freezeTime } from '@/test/clock';
import { buildSession } from '@/test/credentials';
import type { ChatPeer } from '../model/chatPeer';
import { CHATS_QUEUE } from '../model/chatEvent';
import { conversationId } from '../model/chatMessage';
import { ChatConversation } from './ChatConversation';

const EMPLOYEE = 'usr-empleado-001';
const CONVERSATION = conversationId(EMPLOYEE, 'usr-psicologo-001');
const LAURA: ChatPeer = {
  id: 'usr-psicologo-001',
  fullName: 'Laura Martínez',
  title: 'Psicóloga clínica',
};

const session = buildSession('EMPLEADO');

function abrirConversacion() {
  const user = userEvent.setup();
  render(
    <RealtimeFactoryContext value={(token) => createMockRealtimeClient(token, handleChatMessage)}>
      <RealtimeProvider accessToken={session.accessToken}>
        <ChatConversation conversationId={CONVERSATION} peer={LAURA} currentUserId={EMPLOYEE} />
      </RealtimeProvider>
    </RealtimeFactoryContext>,
  );
  return { user };
}

describe('ChatConversation', () => {
  beforeEach(() => {
    freezeTime();
    configureHttpAuth({
      accessToken: session.accessToken,
      onUnauthorized: () => undefined,
    });
  });

  afterEach(() => {
    configureHttpAuth(null);
  });

  it('abre la conversación con el historial que le entrega el servidor', async () => {
    appendChatMessage({
      id: 'mensaje-1',
      conversationId: CONVERSATION,
      senderId: 'usr-psicologo-001',
      senderName: 'Laura Martínez',
      text: '¿Cómo amaneciste?',
      sentAt: new Date(2026, 8, 23, 8).toISOString(),
    });

    abrirConversacion();

    expect(
      await screen.findByRole('log', { name: 'Mensajes con Laura Martínez' }),
    ).toBeInTheDocument();
    expect(screen.getByText('¿Cómo amaneciste?')).toBeInTheDocument();
    expect(screen.getByText('Laura Martínez:')).toBeInTheDocument();
  });

  it('el mensaje que escribe vuelve con los datos que le pone el servidor, una sola vez', async () => {
    const { user } = abrirConversacion();
    await screen.findByText('Aún no tienes mensajes con Laura Martínez');

    await user.type(screen.getByRole('textbox', { name: 'Escribe un mensaje' }), 'Buenos días');
    await user.click(screen.getByRole('button', { name: 'Enviar mensaje' }));

    expect(await screen.findByText('Buenos días')).toBeInTheDocument();
    expect(screen.getByText('Tú:')).toBeInTheDocument();
    expect(screen.getAllByText('Buenos días')).toHaveLength(1);
  });

  it('invita a escribir cuando la conversación todavía no tiene mensajes', async () => {
    abrirConversacion();

    expect(
      await screen.findByText('Aún no tienes mensajes con Laura Martínez'),
    ).toBeInTheDocument();
  });

  it('dice si la otra persona está conectada', async () => {
    abrirConversacion();

    expect(await screen.findByText('Desconectado')).toBeInTheDocument();
  });

  it('avisa en cuanto la otra persona empieza a escribir', async () => {
    abrirConversacion();
    await screen.findByText('Aún no tienes mensajes con Laura Martínez');

    await act(async () => {
      publishToUser(EMPLOYEE, CHATS_QUEUE, {
        type: 'ESCRIBIENDO',
        conversationId: CONVERSATION,
        userId: 'usr-psicologo-001',
        typing: true,
      });
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(await screen.findByText(/Laura Martínez está escribiendo/)).toBeInTheDocument();
  });
});
