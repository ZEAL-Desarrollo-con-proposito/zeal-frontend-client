import { delay, http, HttpResponse } from 'msw';
import { PRESENCE_ENDPOINT } from '@/features/presence/api/presenceApi';
import { authenticate } from './mockAuth';
import { presenceOf } from './presenceDb';

/**Presencia de una persona (HU-BE-10l): cualquier persona autenticada puede consultarla por id.*/
export const presenceHandlers = [
  http.get<{ id: string }>(`*${PRESENCE_ENDPOINT}/:id`, async ({ request, params }) => {
    await delay();
    const user = authenticate(request);
    if (user instanceof Response) {
      return user;
    }
    return HttpResponse.json({ userId: params.id, status: presenceOf(params.id) });
  }),
];
