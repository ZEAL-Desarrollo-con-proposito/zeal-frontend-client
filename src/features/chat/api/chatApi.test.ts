import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { server } from '@/mocks/server';
import { InvalidResponseError } from '@/shared/api/errors';
import { configureHttpAuth } from '@/shared/api/httpClient';
import type { Role } from '@/features/auth/model/session';
import { buildSession } from '@/test/credentials';
import { conversationId } from '../model/chatMessage';
import { CHATS_ENDPOINT, chatHistoryEndpoint, fetchChatHistory } from './chatApi';

const CONVERSATION = conversationId('usr-empleado-001', 'usr-psicologo-001');

function path(conversation = CONVERSATION): string {
  return `*${chatHistoryEndpoint(conversation)}`;
}

function authenticateAs(role: Role) {
  configureHttpAuth({
    accessToken: buildSession(role).accessToken,
    onUnauthorized: () => undefined,
  });
}

function mensaje(id: string, sentAt: string) {
  return {
    id,
    conversationId: CONVERSATION,
    senderId: 'usr-empleado-001',
    senderName: 'David Cajamarca',
    text: `Mensaje ${id}`,
    sentAt,
  };
}

describe('chatApi.chatHistoryEndpoint', () => {
  it('codifica la conversación en la ruta del historial', () => {
    expect(chatHistoryEndpoint('a:b')).toBe(`${CHATS_ENDPOINT}/a%3Ab/mensajes`);
  });
});

describe('chatApi.fetchChatHistory', () => {
  afterEach(() => {
    configureHttpAuth(null);
  });

  it('entrega el historial de la conversación tal como lo devolvió el servidor', async () => {
    authenticateAs('EMPLEADO');
    const ayer = new Date(2026, 8, 22, 18).toISOString();
    const hoy = new Date(2026, 8, 23, 9, 15).toISOString();
    server.use(
      http.get(path(), () => HttpResponse.json([mensaje('m1', ayer), mensaje('m2', hoy)])),
    );

    const history = await fetchChatHistory(CONVERSATION);

    expect(history.map(({ id }) => id)).toEqual(['m1', 'm2']);
  });

  it('rechaza una respuesta que no es una lista de mensajes', async () => {
    authenticateAs('EMPLEADO');
    server.use(http.get(path(), () => HttpResponse.json({ mensajes: [] })));
    await expect(fetchChatHistory(CONVERSATION)).rejects.toBeInstanceOf(InvalidResponseError);

    server.use(
      http.get(path(), () =>
        HttpResponse.json([mensaje('m1', new Date().toISOString()), { id: 'm2' }]),
      ),
    );
    await expect(fetchChatHistory(CONVERSATION)).rejects.toBeInstanceOf(InvalidResponseError);
  });

  it('solo lo entrega a los dos participantes de la conversación', async () => {
    await expect(fetchChatHistory(CONVERSATION)).rejects.toMatchObject({ status: 401 });

    authenticateAs('ADMIN');
    const ajena = conversationId('usr-empleado-004', 'usr-psicologo-004');
    await expect(fetchChatHistory(ajena)).rejects.toMatchObject({ status: 404 });
  });

  it('cancela la petición en curso cuando quien la pidió la aborta', async () => {
    authenticateAs('EMPLEADO');
    const controller = new AbortController();
    controller.abort();

    await expect(fetchChatHistory(CONVERSATION, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});
