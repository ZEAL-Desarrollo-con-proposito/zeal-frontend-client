import { isRecord } from '@/features/auth/model/session';

/**
 * Cola privada de cada participante en el Real-Time Gateway: avisos de la sala. El servidor solo
 * entrega aquí lo que es de las sesiones de la persona. El video ya no pasa por aquí: va por el
 * servidor de medios (LiveKit, ADR-14).
 */
export const ROOMS_QUEUE = '/user/queue/salas';

/** La sala cambió (se activó, se canceló la sesión) y hay que volver a pedirla. */
export interface RoomEvent {
  type: 'SALA_ACTUALIZADA';
  reservationId: string;
}

export function isRoomEvent(value: unknown): value is RoomEvent {
  return (
    isRecord(value) && value.type === 'SALA_ACTUALIZADA' && typeof value.reservationId === 'string'
  );
}
