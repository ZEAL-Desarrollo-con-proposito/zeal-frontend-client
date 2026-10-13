import { delay, http, HttpResponse } from 'msw';
import { WORKSHOPS_ENDPOINT } from '@/features/workshops/api/workshopsApi';
import type { WorkshopRoom } from '@/features/workshopRoom/model/workshopRoom';
import { ROOM_OPENS_BEFORE_MS } from '@/features/workshopRoom/model/workshopRoom';
import { authenticate, errorBody } from '../mockAuth';
import { readWorkshopsDb } from './db';

/** Ruta del servidor de video que entrega el backend: relativa al API Gateway. */
export const MOCK_LIVEKIT_PATH = '/livekit';

const NOT_FOUND = 'No encontramos la sala de este taller o no estás inscrito.';

/**
 * Sala de video del taller como la entrega el Marketplace Service: entran la empresa que lo
 * publicó y las personas inscritas. El permiso (token) solo viene mientras la sala está abierta.
 */
export const workshopRoomHandlers = [
  http.get<{ id: string }>(`*${WORKSHOPS_ENDPOINT}/:id/sala`, async ({ request, params }) => {
    await delay();
    const user = authenticate(request);
    if (user instanceof Response) {
      return user;
    }
    if (user.role === 'PSICOLOGO') {
      return errorBody(403, 'Forbidden', 'No tienes permiso para esta operación.');
    }
    const db = readWorkshopsDb();
    const workshop = db.workshops.find(
      ({ id, organization }) => id === params.id && organization === user.organization,
    );
    const enrolled =
      workshop !== undefined &&
      db.enrollments.some(
        ({ workshopId, userId }) => workshopId === workshop.id && userId === user.id,
      );
    if (workshop === undefined || (user.role === 'EMPLEADO' && !enrolled)) {
      return errorBody(404, 'Not Found', NOT_FOUND);
    }
    const startsAt = Date.parse(workshop.startsAt);
    const opensAt = startsAt - ROOM_OPENS_BEFORE_MS;
    const endsAt = startsAt + workshop.durationMinutes * 60_000;
    const now = Date.now();
    let status: WorkshopRoom['status'] = 'ABIERTA';
    if (now < opensAt) {
      status = 'PROGRAMADA';
    } else if (now >= endsAt) {
      status = 'FINALIZADA';
    }
    const room: WorkshopRoom = {
      workshopId: workshop.id,
      title: workshop.title,
      startsAt: workshop.startsAt,
      endsAt: new Date(endsAt).toISOString(),
      opensAt: new Date(opensAt).toISOString(),
      status,
      role: user.role === 'ADMIN' ? 'ANFITRION' : 'PARTICIPANTE',
      enrolled: workshop.occupied,
      connection:
        status === 'ABIERTA'
          ? { serverUrl: MOCK_LIVEKIT_PATH, token: `token-de-${user.id}-para-${workshop.id}` }
          : null,
    };
    return HttpResponse.json(room);
  }),
];
