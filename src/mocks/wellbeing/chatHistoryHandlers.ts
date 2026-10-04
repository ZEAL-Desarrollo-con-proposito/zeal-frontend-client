import { delay, http, HttpResponse } from 'msw';
import { CHATS_ENDPOINT } from '@/features/chat/api/chatApi';
import { conversationId, parseConversationId } from '@/features/chat/model/chatMessage';
import { authenticate, errorBody } from '../mockAuth';
import { historyOf } from './chatDb';
import { readWellbeingDb } from './db';

/**
 * Historial de una conversación (HU-BE-09, contrato provisional): cualquiera de los dos
 * participantes puede pedirlo, y solo si alguna vez tuvieron una sesión juntos
 */
export const chatHistoryHandlers = [
  http.get<{ id: string }>(`*${CHATS_ENDPOINT}/:id/mensajes`, async ({ request, params }) => {
    await delay();
    const user = authenticate(request);
    if (user instanceof Response) {
      return user;
    }
    const parsed = parseConversationId(decodeURIComponent(params.id));
    if (parsed === null || (user.id !== parsed.employeeId && user.id !== parsed.psychologistId)) {
      return errorBody(404, 'Not Found', 'Esta conversación no existe.');
    }
    const { employeeId, psychologistId } = parsed;
    const haveMetBefore = readWellbeingDb().reservations.some(
      (reservation) =>
        reservation.employee.id === employeeId && reservation.psychologistId === psychologistId,
    );
    if (!haveMetBefore) {
      return errorBody(404, 'Not Found', 'Esta conversación no existe.');
    }
    return HttpResponse.json(historyOf(conversationId(employeeId, psychologistId)));
  }),
];
