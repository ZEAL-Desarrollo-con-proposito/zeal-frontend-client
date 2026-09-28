import { isRecord } from '@/features/auth/model/session';
import type { BadgeTone } from '@/shared/ui/Badge/Badge';

export const ROOM_STATUSES = ['PROGRAMADA', 'ACTIVA', 'CANCELADA', 'FINALIZADA'] as const;

/**
 * Estado de la sala según el servidor: `PROGRAMADA` hasta que el psicólogo la activa, `ACTIVA`
 * después; `CANCELADA` o `FINALIZADA` cuando la sesión ya no admite videollamada.
 */
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/** Sala de una sesión 1:1, vista por cualquiera de sus dos participantes (HU-BE-12). */
export interface Room {
  reservationId: string;
  status: RoomStatus;
  startsAt: string;
  endsAt: string;
  /** Ventana de ingreso: la fija el servidor (regla de negocio), el front solo la compara. */
  opensAt: string;
  closesAt: string;
  /** La otra persona de la sesión. */
  participant: { id: string; fullName: string };
  /** Servidores STUN/TURN para conectar el video; los entrega el servidor con credenciales. */
  iceServers: IceServer[];
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isIceServer(value: unknown): value is IceServer {
  return (
    isRecord(value) &&
    (typeof value.urls === 'string' ||
      (Array.isArray(value.urls) && value.urls.every((url) => typeof url === 'string'))) &&
    (value.username === undefined || typeof value.username === 'string') &&
    (value.credential === undefined || typeof value.credential === 'string')
  );
}

export function isRoom(value: unknown): value is Room {
  return (
    isRecord(value) &&
    typeof value.reservationId === 'string' &&
    ROOM_STATUSES.some((status) => status === value.status) &&
    isIsoDateTime(value.startsAt) &&
    isIsoDateTime(value.endsAt) &&
    isIsoDateTime(value.opensAt) &&
    isIsoDateTime(value.closesAt) &&
    isRecord(value.participant) &&
    typeof value.participant.id === 'string' &&
    typeof value.participant.fullName === 'string' &&
    Array.isArray(value.iceServers) &&
    value.iceServers.every(isIceServer)
  );
}

/** Qué puede hacer la persona en la sala ahora: el estado del servidor leído con el reloj. */
export type RoomPhase =
  | { kind: 'upcoming'; opensAt: Date }
  | { kind: 'scheduled' }
  | { kind: 'active' }
  | { kind: 'closed' }
  | { kind: 'cancelled' }
  | { kind: 'finished' };

export function roomPhase(room: Room, now: number): RoomPhase {
  if (room.status === 'CANCELADA') {
    return { kind: 'cancelled' };
  }
  if (room.status === 'FINALIZADA') {
    return { kind: 'finished' };
  }
  const opensAt = Date.parse(room.opensAt);
  if (now < opensAt) {
    return { kind: 'upcoming', opensAt: new Date(opensAt) };
  }
  if (now > Date.parse(room.closesAt)) {
    return { kind: 'closed' };
  }
  return room.status === 'ACTIVA' ? { kind: 'active' } : { kind: 'scheduled' };
}

/** Etiqueta de la cabecera: "En curso" es una lectura del reloj sobre una sesión vigente. */
export function roomBadge(room: Room, now: number): { label: string; tone: BadgeTone } {
  if (room.status === 'CANCELADA') {
    return { label: 'Cancelada', tone: 'coral' };
  }
  if (room.status === 'FINALIZADA') {
    return { label: 'Finalizada', tone: 'neutral' };
  }
  const inProgress = Date.parse(room.startsAt) <= now && now < Date.parse(room.endsAt);
  return inProgress ? { label: 'En curso', tone: 'teal' } : { label: 'Confirmada', tone: 'sage' };
}
