import { isRecord } from '@/features/auth/model/session';

/**
 * Cola privada de cada participante en el Real-Time Gateway: avisos de la sala y señalización
 * de la videollamada. El servidor solo entrega aquí lo que es de las sesiones de la persona.
 */
export const ROOMS_QUEUE = '/user/queue/salas';

/** A dónde envía cada participante sus señales; el servidor las reenvía a la otra persona. */
export function signalDestination(reservationId: string): string {
  return `/app/salas/${encodeURIComponent(reservationId)}/senales`;
}

/** Micrófono y cámara encendidos o apagados. */
export interface MediaState {
  audio: boolean;
  video: boolean;
}

export interface IceCandidate {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

/**
 * Señales de la videollamada (WebRTC). `LISTO`: entré o me reconecté (el psicólogo responde con
 * una oferta). `MEDIOS`: cambié el micrófono o la cámara. `SALIO`: dejé la sala.
 * Oferta, respuesta y candidatos llevan el `id` de su negociación: lo de una anterior se descarta.
 */
export type Signal =
  | { type: 'LISTO'; media: MediaState }
  | { type: 'OFERTA'; id: string; sdp: string }
  | { type: 'RESPUESTA'; id: string; sdp: string }
  | { type: 'CANDIDATO'; id: string; candidate: IceCandidate }
  | { type: 'MEDIOS'; media: MediaState }
  | { type: 'SALIO' };

/**
 * `SALA_ACTUALIZADA`: la sala cambió (se activó, se canceló la sesión) y hay que volver a pedirla.
 * `SENAL`: señal de la otra persona para la videollamada.
 */
export type RoomEvent =
  | { type: 'SALA_ACTUALIZADA'; reservationId: string }
  | { type: 'SENAL'; reservationId: string; signal: Signal };

function isMediaState(value: unknown): value is MediaState {
  return isRecord(value) && typeof value.audio === 'boolean' && typeof value.video === 'boolean';
}

function isNullable<T>(value: unknown, guard: (candidate: unknown) => candidate is T) {
  return value === null || guard(value);
}

function isIceCandidate(value: unknown): value is IceCandidate {
  return (
    isRecord(value) &&
    typeof value.candidate === 'string' &&
    isNullable(value.sdpMid, (mid): mid is string => typeof mid === 'string') &&
    isNullable(value.sdpMLineIndex, (index): index is number => typeof index === 'number')
  );
}

export function isSignal(value: unknown): value is Signal {
  if (!isRecord(value)) {
    return false;
  }
  switch (value.type) {
    case 'LISTO':
    case 'MEDIOS':
      return isMediaState(value.media);
    case 'OFERTA':
    case 'RESPUESTA':
      return typeof value.id === 'string' && typeof value.sdp === 'string';
    case 'CANDIDATO':
      return typeof value.id === 'string' && isIceCandidate(value.candidate);
    case 'SALIO':
      return true;
    default:
      return false;
  }
}

export function isRoomEvent(value: unknown): value is RoomEvent {
  if (!isRecord(value) || typeof value.reservationId !== 'string') {
    return false;
  }
  if (value.type === 'SENAL') {
    return isSignal(value.signal);
  }
  return value.type === 'SALA_ACTUALIZADA';
}
