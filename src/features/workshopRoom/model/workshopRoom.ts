import { isRecord } from '@/features/auth/model/session';
import type { VideoConnection } from '@/features/videoCall/call/videoCall';
import { isVideoConnection } from '@/features/videoCall/call/videoCall';
import { isIsoDateTime } from '@/shared/lib/dates';

export const WORKSHOP_ROOM_STATUSES = ['PROGRAMADA', 'ABIERTA', 'FINALIZADA'] as const;
export const WORKSHOP_ROOM_ROLES = ['ANFITRION', 'PARTICIPANTE'] as const;

/** `PROGRAMADA` hasta 10 min antes del taller, `ABIERTA` mientras dura, `FINALIZADA` después. */
export type WorkshopRoomStatus = (typeof WORKSHOP_ROOM_STATUSES)[number];
/** La empresa que dicta el taller es la anfitriona; las personas inscritas, participantes. */
export type WorkshopRoomRole = (typeof WORKSHOP_ROOM_ROLES)[number];

/** Sala de video grupal de un taller (Business Domain), vista por una persona con acceso. */
export interface WorkshopRoom {
  workshopId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  /** Ventana de ingreso: la fija el servidor, el front solo la compara con el reloj. */
  opensAt: string;
  status: WorkshopRoomStatus;
  role: WorkshopRoomRole;
  /** Personas inscritas al taller. */
  enrolled: number;
  /** Dónde y con qué permiso conectarse al servidor de video; solo viene con la sala abierta. */
  connection: VideoConnection | null;
}

export function isWorkshopRoom(value: unknown): value is WorkshopRoom {
  return (
    isRecord(value) &&
    typeof value.workshopId === 'string' &&
    typeof value.title === 'string' &&
    isIsoDateTime(value.startsAt) &&
    isIsoDateTime(value.endsAt) &&
    isIsoDateTime(value.opensAt) &&
    WORKSHOP_ROOM_STATUSES.some((status) => status === value.status) &&
    WORKSHOP_ROOM_ROLES.some((role) => role === value.role) &&
    typeof value.enrolled === 'number' &&
    (value.connection === null || isVideoConnection(value.connection)) &&
    (value.status !== 'ABIERTA' || value.connection !== null)
  );
}

/**
 * Lo que la persona puede hacer ahora: el estado del servidor leído con el reloj. Si la hora de
 * apertura o de cierre ya pasó pero el servidor aún no lo sabe, hay que volver a pedir la sala.
 */
export type WorkshopRoomPhase =
  | { kind: 'upcoming'; opensAt: Date }
  | { kind: 'open'; connection: VideoConnection }
  | { kind: 'finished' }
  | { kind: 'stale' };

export function workshopRoomPhase(room: WorkshopRoom, now: number): WorkshopRoomPhase {
  const opensAt = Date.parse(room.opensAt);
  const endsAt = Date.parse(room.endsAt);
  if (room.status === 'FINALIZADA') {
    return { kind: 'finished' };
  }
  if (room.status === 'PROGRAMADA') {
    return now < opensAt ? { kind: 'upcoming', opensAt: new Date(opensAt) } : { kind: 'stale' };
  }
  if (now >= endsAt || room.connection === null) {
    return { kind: 'stale' };
  }
  return { kind: 'open', connection: room.connection };
}

/** Antes del taller la sala abre con esta anticipación (regla del servidor, para mostrar el enlace). */
export const ROOM_OPENS_BEFORE_MS = 10 * 60_000;

/** El enlace a la sala se muestra desde que abre hasta que el taller termina. */
export function isRoomWindow(
  { startsAt, durationMinutes }: { startsAt: string; durationMinutes: number },
  now: number,
): boolean {
  const start = Date.parse(startsAt);
  return now >= start - ROOM_OPENS_BEFORE_MS && now < start + durationMinutes * 60_000;
}
