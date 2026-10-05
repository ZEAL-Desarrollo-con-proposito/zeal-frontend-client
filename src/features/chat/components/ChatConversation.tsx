import { usePresence } from '@/features/presence/hooks/usePresence';
import { useChatClient } from '../hooks/useChatClient';
import { useTypingEmitter } from '../hooks/useTypingEmitter';
import { useTypingIndicator } from '../hooks/useTypingIndicator';
import type { ChatPeer } from '../model/chatPeer';
import { ChatWindow } from './ChatWindow';

interface ChatConversationProps {
  conversationId: string;
  peer: ChatPeer;
  currentUserId: string;
}

/**
 * Pegamento entre los hooks del chat y `ChatWindow`: pide el historial, se suscribe a la cola
 * privada, publica los envíos, sigue la presencia de la otra persona (Task 353) y el aviso de
 * escritura en ambos sentidos (Tasks 354-355; `ChatComposer` ya avisa el fin al enviar).
 */
export function ChatConversation({
  conversationId,
  peer,
  currentUserId,
}: Readonly<ChatConversationProps>) {
  const { messages, historyStatus, reloadHistory, connectionStatus, sendMessage } = useChatClient({
    conversationId,
  });
  const peerStatus = usePresence(peer.id);
  const peerTyping = useTypingIndicator(conversationId, currentUserId);
  const { notifyTyping } = useTypingEmitter(conversationId);

  return (
    <ChatWindow
      peer={peer}
      currentUserId={currentUserId}
      messages={messages}
      onSend={sendMessage}
      historyStatus={historyStatus}
      onRetryHistory={reloadHistory}
      connectionStatus={connectionStatus}
      peerStatus={peerStatus}
      peerTyping={peerTyping}
      onTyping={notifyTyping}
    />
  );
}
