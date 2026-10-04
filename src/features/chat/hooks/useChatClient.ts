import { useCallback, useReducer } from 'react';
import {
  useRealtimePublish,
  useRealtimeStatus,
  useRealtimeSubscription,
} from '@/shared/realtime/useRealtime';
import type { ChatOutgoing } from '../model/chatEvent';
import { CHATS_QUEUE, chatSendDestination, isChatEvent } from '../model/chatEvent';
import type { ChatMessage } from '../model/chatMessage';

interface ChatClientState {
  conversationId: string;
  messages: ChatMessage[];
}

type ChatClientAction =
  { type: 'reset'; conversationId: string } | { type: 'received'; message: ChatMessage };

function chatClientReducer(state: ChatClientState, action: ChatClientAction): ChatClientState {
  if (action.type === 'reset') {
    return { conversationId: action.conversationId, messages: [] };
  }
  if (state.messages.some(({ id }) => id === action.message.id)) {
    return state;
  }
  return {
    ...state,
    messages: [...state.messages, action.message].sort(
      (a, b) => Date.parse(a.sentAt) - Date.parse(b.sentAt),
    ),
  };
}

interface ChatClientOptions {
  conversationId: string;
}

/**Cliente de chat en tiempo real (HU-FE-09 · Task 347): se suscribe a la cola privada de la
 * persona y publica lo que escribe en esta conversación por el Real-Time. */
export function useChatClient({ conversationId }: ChatClientOptions) {
  const [state, dispatch] = useReducer(chatClientReducer, { conversationId, messages: [] });
  // Cambiar de conversación limpia los mensajes de la anterior, sin esperar un efecto.
  if (state.conversationId !== conversationId) {
    dispatch({ type: 'reset', conversationId });
  }

  const publish = useRealtimePublish();
  const { status, recoveries } = useRealtimeStatus();

  useRealtimeSubscription(CHATS_QUEUE, (payload) => {
    if (isChatEvent(payload) && payload.message.conversationId === conversationId) {
      dispatch({ type: 'received', message: payload.message });
    }
  });

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (trimmed === '') {
        return;
      }
      publish(chatSendDestination(conversationId), { text: trimmed } satisfies ChatOutgoing);
    },
    [publish, conversationId],
  );

  return { messages: state.messages, status, recoveries, sendMessage };
}