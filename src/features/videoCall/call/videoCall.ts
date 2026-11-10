/**
 * Videollamada por el servidor de medios (SFU): la usan la sesión 1:1 y los talleres en vivo, con
 * un solo camino de medios (ADR-14).
 */

/** Micrófono y cámara encendidos o apagados. */
export interface MediaState {
  audio: boolean;
  video: boolean;
}

/** Dónde y con qué permiso conectarse al servidor de video; el backend lo entrega con la sala. */
export interface VideoConnection {
  serverUrl: string;
  token: string;
}

/** Una persona en la videollamada, tal como se dibuja. */
export interface CallParticipant {
  id: string;
  name: string;
  /** Quien recibe a los demás: la empresa en un taller. */
  host: boolean;
  self: boolean;
  /** Video y, si es otra persona, su audio; `null` mientras no publica nada. */
  stream: MediaStream | null;
  media: MediaState;
  speaking: boolean;
}

/** `ended`: el servidor cerró la conexión (la sala cerró o se perdió sin recuperarse). */
export type VideoCallStatus = 'connected' | 'reconnecting' | 'ended';

export interface VideoCallSnapshot {
  status: VideoCallStatus;
  /** La persona misma primero; después el resto en orden de llegada. */
  participants: CallParticipant[];
}

/** Mensaje del chat de la sala. Viaja por la sala de video: solo lo ven quienes están adentro. */
export interface CallChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  sentAt: string;
  self: boolean;
}

/** Límite de un mensaje del chat de la sala (el mismo del chat 1:1). */
export const MAX_CHAT_MESSAGE_LENGTH = 2000;

export interface VideoCall {
  /** Enciende o apaga micrófono y cámara; el navegador pide permiso la primera vez. */
  setMedia: (media: MediaState) => Promise<void>;
  /** Envía un mensaje a todas las personas de la sala. */
  sendMessage: (text: string) => Promise<void>;
  leave: () => void;
}

export interface VideoCallOptions extends VideoConnection {
  onChange: (snapshot: VideoCallSnapshot) => void;
  /** Llega un mensaje del chat, de otra persona o el propio ya enviado. */
  onMessage: (message: CallChatMessage) => void;
}

/** Conecta con el servidor de video (SFU). En el navegador lo implementa LiveKit. */
export type VideoCallConnector = (options: VideoCallOptions) => Promise<VideoCall>;

/** Cómo se rotula a cada persona: "Tú" para uno mismo y "· Anfitrión" para quien recibe. */
export function participantLabel({ name, host, self }: CallParticipant): string {
  const who = self ? 'Tú' : name;
  return host ? `${who} · Anfitrión` : who;
}

/**
 * URL WebSocket del servidor de video. Una ruta relativa ("/livekit") se resuelve contra el API
 * Gateway, que también enruta la señalización del video.
 */
export function resolveServerUrl(serverUrl: string, apiBaseUrl: string): string {
  const url = new URL(serverUrl, apiBaseUrl);
  url.protocol = url.protocol === 'https:' || url.protocol === 'wss:' ? 'wss:' : 'ws:';
  return url.toString().replace(/\/$/, '');
}

/** El backend la entrega dentro de la sala: lo que llega del servidor se valida. */
export function isVideoConnection(value: unknown): value is VideoConnection {
  return (
    typeof value === 'object' &&
    value !== null &&
    'serverUrl' in value &&
    typeof value.serverUrl === 'string' &&
    'token' in value &&
    typeof value.token === 'string'
  );
}
