import { delay, http, HttpResponse } from 'msw';
import type { Room } from '@/features/sessionRoom/model/room';
import { isSignal, ROOMS_QUEUE } from '@/features/sessionRoom/model/roomEvent';
import { RESERVATIONS_ENDPOINT } from '@/features/agenda/api/agendaApi';
import { formatTime } from '@/shared/lib/dates';
import { authenticate, authorize, errorBody } from '../mockAuth';
import { publishToUser } from '../realtime';
import type { ReservationRecord, WellbeingDb } from './db';
import { readWellbeingDb, writeWellbeingDb } from './db';
import { joinWindow } from './handlers';

/**
 * Sala de la sesión de una reserva vista por uno de sus participantes (HU-BE-12); `null` si la
 * persona no participa en esa sesión. El estado lo decide el servidor.
 */
function roomFor(record: ReservationRecord, userId: string, db: WellbeingDb, now: number) {
  const psychologist = db.psychologists.find(({ id }) => id === record.psychologistId);
  let participant: Room['participant'] | undefined;
  if (userId === record.psychologistId) {
    participant = record.employee;
  } else if (userId === record.employee.id && psychologist !== undefined) {
    participant = { id: psychologist.id, fullName: psychologist.fullName };
  }
  if (participant === undefined) {
    return null;
  }
  const { opensAt, closesAt } = joinWindow(record);
  let status: Room['status'] = record.roomActivatedAt === undefined ? 'PROGRAMADA' : 'ACTIVA';
  if (record.status === 'CANCELADA') {
    status = 'CANCELADA';
  } else if (record.status === 'FINALIZADA' || Date.parse(record.endsAt) <= now) {
    status = 'FINALIZADA';
  }
  const room: Room = {
    reservationId: record.id,
    status,
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    opensAt: opensAt.toISOString(),
    closesAt: closesAt.toISOString(),
    participant: { id: participant.id, fullName: participant.fullName },
    // En la demo las dos pestañas están en el mismo equipo: no hace falta STUN ni TURN.
    iceServers: [],
  };
  return room;
}

function findRoom(reservationId: string | undefined, userId: string) {
  const db = readWellbeingDb();
  const record = db.reservations.find(({ id }) => id === reservationId);
  const room = record === undefined ? null : roomFor(record, userId, db, Date.now());
  return { db, record, room };
}

/** Avisa a los dos participantes (y a sus otras pestañas) que la sala cambió. */
function announceRoomChange(record: ReservationRecord) {
  const event = { type: 'SALA_ACTUALIZADA', reservationId: record.id };
  publishToUser(record.psychologistId, ROOMS_QUEUE, event);
  publishToUser(record.employee.id, ROOMS_QUEUE, event);
}

export const roomHandlers = [
  http.get<{ id: string }>(`*${RESERVATIONS_ENDPOINT}/:id/sala`, async ({ request, params }) => {
    await delay();
    const user = authenticate(request);
    if (user instanceof Response) {
      return user;
    }
    // HU-BE-11 y SEG-2: los roles empresariales no participan en ninguna sesión: 404, como cualquiera.
    const { room } = findRoom(params.id, user.id);
    if (room === null) {
      return errorBody(404, 'Not Found', 'Esta sesión no existe o no es tuya.');
    }
    return HttpResponse.json(room);
  }),

  /** Solo el psicólogo de la sesión la activa, y solo dentro de la ventana de ingreso. */
  http.post<{ id: string }>(
    `*${RESERVATIONS_ENDPOINT}/:id/sala/activar`,
    async ({ request, params }) => {
      await delay();
      const user = authorize(request, 'PSICOLOGO');
      if (user instanceof Response) {
        return user;
      }
      const { db, record, room } = findRoom(params.id, user.id);
      if (record === undefined || room === null) {
        return errorBody(404, 'Not Found', 'Esta sesión no existe o no es tuya.');
      }
      const now = Date.now();
      const { opensAt, closesAt } = joinWindow(record);
      if (room.status === 'CANCELADA') {
        return errorBody(409, 'Conflict', 'Esta sesión fue cancelada.');
      }
      if (room.status === 'FINALIZADA' || now > closesAt.getTime()) {
        return errorBody(409, 'Conflict', 'La sala de esta sesión ya cerró.');
      }
      if (now < opensAt.getTime()) {
        return errorBody(409, 'Conflict', `La sala abre a las ${formatTime(opensAt)}.`);
      }
      if (record.roomActivatedAt === undefined) {
        record.roomActivatedAt = new Date(now).toISOString();
        writeWellbeingDb(db);
        announceRoomChange(record);
      }
      return HttpResponse.json({ ...room, status: 'ACTIVA' } satisfies Room);
    },
  ),
];

const SIGNAL_DESTINATION = /^\/app\/salas\/([^/]+)\/senales$/;

/**
 * Señalización de la videollamada (como un `@MessageMapping` de Spring): reenvía la señal a la
 * otra persona, solo entre los dos participantes y con la sala activa y abierta.
 */
export function handleRoomMessage(userId: string, destination: string, payload: unknown): void {
  const reservationId = SIGNAL_DESTINATION.exec(destination)?.[1];
  if (reservationId === undefined || !isSignal(payload)) {
    return;
  }
  const { room } = findRoom(decodeURIComponent(reservationId), userId);
  if (room?.status !== 'ACTIVA' || Date.now() > Date.parse(room.closesAt)) {
    return;
  }
  publishToUser(room.participant.id, ROOMS_QUEUE, {
    type: 'SENAL',
    reservationId: room.reservationId,
    signal: payload,
  });
}
