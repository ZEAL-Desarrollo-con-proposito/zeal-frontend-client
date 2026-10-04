import { useChatClient } from '../hooks/useChatClient';
import type { ChatPeer } from '../model/chatPeer';
import { ChatWindow } from './ChatWindow';

interface ChatConversationProps {
  conversationId: string;
  peer: ChatPeer;
  currentUserId: string;
}

/**
 * Pegamento entre `useChatClient` y `ChatWindow`: pide el historial, se suscribe a la cola
 * privada y publica los envíos.
 */
export function ChatConversation({
  conversationId,
  peer,
  currentUserId,
}: Readonly<ChatConversationProps>) {
  const { messages, historyStatus, reloadHistory, connectionStatus, sendMessage } = useChatClient({
    conversationId,
  });

  return (
    <ChatWindow
      peer={peer}
      currentUserId={currentUserId}
      messages={messages}
      onSend={sendMessage}
      historyStatus={historyStatus}
      onRetryHistory={reloadHistory}
      connectionStatus={connectionStatus}
    />
  );
}
