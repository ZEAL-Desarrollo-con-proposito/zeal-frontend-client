import type { MediaState } from '@/features/sessionRoom/model/roomEvent';

/** Una persona en la videollamada del taller, tal como se dibuja. */
export interface GroupParticipant {
  id: string;
  name: string;
  /** La empresa que dicta el taller. */
  host: boolean;
  self: boolean;
  /** Video y, si es otra persona, su audio; `null` mientras no publica nada. */
  stream: MediaStream | null;
  media: MediaState;
  speaking: boolean;
}

/** `ended`: el servidor cerró la conexión (la sala cerró o se perdió sin recuperarse). */
export type GroupCallStatus = 'connected' | 'reconnecting' | 'ended';

export interface GroupCallSnapshot {
  status: GroupCallStatus;
  /** La persona misma primero; después el resto en orden de llegada. */
  participants: GroupParticipant[];
}

/** Mensaje del chat del taller. Viaja por la sala de video: solo lo ven quienes están adentro. */
export interface GroupChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  sentAt: string;
  self: boolean;
}

/** Límite de un mensaje del chat del taller (el mismo del chat 1:1). */
export const MAX_CHAT_MESSAGE_LENGTH = 2000;

export interface GroupCall {
  /** Enciende o apaga micrófono y cámara; el navegador pide permiso la primera vez. */
  setMedia: (media: MediaState) => Promise<void>;
  /** Envía un mensaje a todas las personas de la sala. */
  sendMessage: (text: string) => Promise<void>;
  leave: () => void;
}

export interface GroupCallOptions {
  serverUrl: string;
  token: string;
  onChange: (snapshot: GroupCallSnapshot) => void;
  /** Llega un mensaje del chat, de otra persona o el propio ya enviado. */
  onMessage: (message: GroupChatMessage) => void;
}

/** Conecta con el servidor de video (SFU). En el navegador lo implementa LiveKit. */
export type GroupCallConnector = (options: GroupCallOptions) => Promise<GroupCall>;

/** Cómo se rotula a cada persona: "Tú" para uno mismo y "· Anfitrión" para la empresa. */
export function participantLabel({ name, host, self }: GroupParticipant): string {
  const who = self ? 'Tú' : name;
  return host ? `${who} · Anfitrión` : who;
}
