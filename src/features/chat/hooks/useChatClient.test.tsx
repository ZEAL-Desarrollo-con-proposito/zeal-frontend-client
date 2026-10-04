import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMockRealtimeClient, publishToUser } from '@/mocks/realtime';
import type { MockMessageHandler } from '@/mocks/realtime';
import { server } from '@/mocks/server';
import { configureHttpAuth } from '@/shared/api/httpClient';
import { RealtimeFactoryContext } from '@/shared/realtime/RealtimeContext';
import { RealtimeProvider } from '@/shared/realtime/RealtimeProvider';
import { buildSession } from '@/test/credentials';
import { chatHistoryEndpoint } from '../api/chatApi';
import { CHATS_QUEUE, chatSendDestination } from '../model/chatEvent';
import type { ChatMessage } from '../model/chatMessage';
import { conversationId } from '../model/chatMessage';
import { useChatClient } from './useChatClient';

const EMPLOYEE = 'usr-empleado-001';
const PSYCHOLOGIST = 'usr-psicologo-001';
const CONVERSATION = conversationId(EMPLOYEE, PSYCHOLOGIST);
const OTRA_CONVERSATION = conversationId('usr-empleado-002', 'usr-psicologo-002');

const session = buildSession('EMPLEADO');

function mensaje(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'mensaje-1',
    conversationId: CONVERSATION,
    senderId: PSYCHOLOGIST,
    senderName: 'Laura Martínez',
    text: '¿Cómo amaneciste?',
    sentAt: new Date(2026, 8, 23, 9, 15).toISOString(),
    ...overrides,
  };
}

/** El cliente de la sesión, con un servidor simulado que registra lo que la persona publica. */
function renderClient() {
  const published: { userId: string; destination: string; payload: unknown }[] = [];
  const onMessage: MockMessageHandler = (userId, destination, payload) => {
    published.push({ userId, destination, payload });
  };

  const view = renderHook(
    ({ conversationId }: { conversationId: string }) => useChatClient({ conversationId }),
    {
      initialProps: { conversationId: CONVERSATION },
      wrapper: ({ children }: { children: ReactNode }) => (
        <RealtimeFactoryContext value={(token) => createMockRealtimeClient(token, onMessage)}>
          <RealtimeProvider accessToken={session.accessToken}>{children}</RealtimeProvider>
        </RealtimeFactoryContext>
      ),
    },
  );
  return { ...view, published };
}

function historialDe(conversation: string, mensajes: ChatMessage[]) {
  server.use(http.get(`*${chatHistoryEndpoint(conversation)}`, () => HttpResponse.json(mensajes)));
}

async function abrir() {
  const cliente = renderClient();
  await waitFor(() => {
    expect(cliente.result.current.historyStatus).toBe('ready');
  });
  return cliente;
}

/** Espera a que la cola privada entregue lo que se publicó (BroadcastChannel es asíncrona). */
function llegaElMensaje() {
  return act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

describe('useChatClient', () => {
  beforeEach(() => {
    configureHttpAuth({
      accessToken: session.accessToken,
      onUnauthorized: () => undefined,
    });
  });

  afterEach(() => {
    configureHttpAuth(null);
  });

  it('abre la conversación pidiendo el historial y con la conexión ya conectada', async () => {
    historialDe(CONVERSATION, [
      mensaje(),
      mensaje({ id: 'mensaje-2', sentAt: new Date(2026, 8, 23, 10).toISOString() }),
    ]);

    const { result } = renderClient();

    expect(result.current.historyStatus).toBe('loading');
    expect(result.current.messages).toEqual([]);
    await waitFor(() => {
      expect(result.current.historyStatus).toBe('ready');
    });
    expect(result.current.messages.map(({ id }) => id)).toEqual(['mensaje-1', 'mensaje-2']);
    expect(result.current.connectionStatus).toBe('connected');
  });

  it('suma al instante lo que llega en vivo a la cola privada de la persona', async () => {
    historialDe(CONVERSATION, [mensaje()]);
    const { result } = await abrir();

    await llegaElMensaje();
    act(() => {
      publishToUser(EMPLOYEE, CHATS_QUEUE, { type: 'NUEVO', message: mensaje({ id: 'en-vivo' }) });
    });
    await llegaElMensaje();

    expect(result.current.messages.map(({ id }) => id)).toEqual(['mensaje-1', 'en-vivo']);
  });

  it('no repite un mensaje que ya había llegado', async () => {
    historialDe(CONVERSATION, [mensaje()]);
    const { result } = await abrir();
    const repetido = mensaje({ id: 'repetido' });

    await llegaElMensaje();
    act(() => {
      publishToUser(EMPLOYEE, CHATS_QUEUE, { type: 'NUEVO', message: repetido });
      publishToUser(EMPLOYEE, CHATS_QUEUE, { type: 'NUEVO', message: repetido });
    });
    await llegaElMensaje();

    expect(result.current.messages.filter(({ id }) => id === 'repetido')).toHaveLength(1);
  });

  it('ignora lo que no es un mensaje nuevo o es de otra conversación', async () => {
    historialDe(CONVERSATION, [mensaje()]);
    const { result } = await abrir();

    await llegaElMensaje();
    act(() => {
      publishToUser(EMPLOYEE, CHATS_QUEUE, 'hola');
      publishToUser(EMPLOYEE, CHATS_QUEUE, { type: 'NUEVO' });
      publishToUser(EMPLOYEE, CHATS_QUEUE, { type: 'BORRADO', message: mensaje({ id: 'x' }) });
      publishToUser(EMPLOYEE, CHATS_QUEUE, {
        type: 'NUEVO',
        message: mensaje({ id: 'ajeno', conversationId: OTRA_CONVERSATION }),
      });
    });
    await llegaElMensaje();

    expect(result.current.messages.map(({ id }) => id)).toEqual(['mensaje-1']);
  });

  it('publica lo que la persona escribe en el destino de su conversación', async () => {
    historialDe(CONVERSATION, []);
    const { result, published } = await abrir();

    act(() => {
      result.current.sendMessage('  Buenos días  ');
    });

    expect(published).toEqual([
      {
        userId: EMPLOYEE,
        destination: chatSendDestination(CONVERSATION),
        payload: { text: 'Buenos días' },
      },
    ]);
  });

  it('no publica texto en blanco', async () => {
    historialDe(CONVERSATION, []);
    const { result, published } = await abrir();

    act(() => {
      result.current.sendMessage('   ');
    });

    expect(published).toEqual([]);
  });

  it('al cambiar de conversación vacía lo que había llegado en vivo', async () => {
    historialDe(CONVERSATION, [mensaje()]);
    historialDe(OTRA_CONVERSATION, []);
    const { result, rerender } = await abrir();

    await llegaElMensaje();
    act(() => {
      publishToUser(EMPLOYEE, CHATS_QUEUE, { type: 'NUEVO', message: mensaje({ id: 'en-vivo' }) });
    });
    await llegaElMensaje();
    expect(result.current.messages).toHaveLength(2);

    rerender({ conversationId: OTRA_CONVERSATION });
    await waitFor(() => {
      expect(result.current.messages).toEqual([]);
    });
  });
});
