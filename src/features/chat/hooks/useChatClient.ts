import { useCallback, useReducer } from 'react';
import { useFetch } from '@/shared/hooks/useFetch';
import {
  useRealtimePublish,
  useRealtimeStatus,
  useRealtimeSubscription,
} from '@/shared/realtime/useRealtime';
import { fetchChatHistory } from '../api/chatApi';
import type { ChatOutgoing } from '../model/chatEvent';
import { CHATS_QUEUE, chatSendDestination, isChatEvent } from '../model/chatEvent';
import type { ChatMessage } from '../model/chatMessage';
import { mergeChatMessages } from '../model/chatMessage';

interface LiveMessagesState {
  conversationId: string;
  messages: ChatMessage[];
}

type LiveMessagesAction =
  { type: 'reset'; conversationId: string } | { type: 'received'; message: ChatMessage };

/** Solo lo que llega en vivo por la cola privada mientras el chat está montado. */
function liveMessagesReducer(
  state: LiveMessagesState,
  action: LiveMessagesAction,
): LiveMessagesState {
  if (action.type === 'reset') {
    return { conversationId: action.conversationId, messages: [] };
  }
  if (state.messages.some(({ id }) => id === action.message.id)) {
    return state; // ya lo teníamos (p. ej. un eco duplicado tras una reconexión)
  }
  return { ...state, messages: [...state.messages, action.message] };
}

interface ChatClientOptions {
  conversationId: string;
}

/**Cliente de chat en tiempo real (HU-FE-09 · Task 347): se suscribe a la cola privada de la
 * persona y publica lo que escribe en esta conversación por el Real-Time. */

export function useChatClient({ conversationId }: ChatClientOptions) {
  const [live, dispatch] = useReducer(liveMessagesReducer, { conversationId, messages: [] });
  if (live.conversationId !== conversationId) {
    dispatch({ type: 'reset', conversationId });
  }

  const publish = useRealtimePublish();
  const { status, recoveries } = useRealtimeStatus();

  const history = useFetch(`${conversationId}/${String(recoveries)}`, (signal) =>
    fetchChatHistory(conversationId, signal),
  );

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

  return {
    messages: mergeChatMessages(history.data ?? [], live.messages),
    historyStatus: history.status,
    reloadHistory: history.reload,
    connectionStatus: status,
    sendMessage,
  };
}
