import { act, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PSYCHOLOGIST_PATHS } from '@/app/paths';
import { publishMockEvent } from '@/mocks/realtime';
import { server } from '@/mocks/server';
import { readWellbeingDb, writeWellbeingDb } from '@/mocks/wellbeing/db';
import { freezeTime } from '@/test/clock';
import { buildSession, storeSession } from '@/test/credentials';
import type { RealtimeClient } from '@/shared/realtime/realtimeClient';
import { controlledRealtimeClient } from '@/test/realtime';
import { renderRoute } from '@/test/renderRoute';
import { MY_SLOTS_ENDPOINT, SLOTS_ENDPOINT } from '../api/availabilityApi';
import type { Slot } from '../model/slot';
import { SLOTS_TOPIC } from '../model/slotEvent';

function wednesday() {
  return within(screen.getByRole('region', { name: 'Miércoles, 23 de septiembre' }));
}

function announcements() {
  return screen.getByRole('status', { name: 'Avisos de disponibilidad' });
}

async function openAvailability(realtimeFactory?: () => RealtimeClient) {
  storeSession('PSICOLOGO');
  const rendered = renderRoute(PSYCHOLOGIST_PATHS.availability, realtimeFactory);
  await wednesday().findAllByRole('listitem');
  return rendered;
}

/** La misma psicóloga en otra pestaña (u otro dispositivo) cambia su agenda. */
function anotherSession(method: 'POST' | 'DELETE', path: string, body?: object) {
  return fetch(new URL(path, window.location.origin), {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${buildSession('PSICOLOGO').accessToken}`,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function seededSlot(start: Date): Slot {
  const slot = readWellbeingDb().slots.find(
    (candidate) => candidate.startsAt === start.toISOString(),
  );
  if (slot === undefined) {
    throw new Error('Franja semilla no encontrada');
  }
  return slot;
}

describe('Mi disponibilidad · en tiempo real (RT-2)', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('muestra al instante una franja abierta desde otra sesión', async () => {
    await openAvailability();

    await act(() =>
      anotherSession('POST', SLOTS_ENDPOINT, {
        startsAt: new Date(2026, 8, 23, 12).toISOString(),
        endsAt: new Date(2026, 8, 23, 12, 50).toISOString(),
      }),
    );

    expect(await wednesday().findByText('12:00 – 12:50')).toBeInTheDocument();
  });

  it('retira al instante una franja eliminada desde otra sesión', async () => {
    await openAvailability();
    const slot = seededSlot(new Date(2026, 8, 23, 10));

    await act(() => anotherSession('DELETE', `${SLOTS_ENDPOINT}/${slot.id}`));

    await waitFor(() => {
      expect(wednesday().queryByText('10:00 – 10:50')).not.toBeInTheDocument();
    });
  });

  it('avisa cuando un paciente reserva o libera una franja', async () => {
    await openAvailability();
    const slot = seededSlot(new Date(2026, 8, 23, 10));

    act(() => {
      publishMockEvent(SLOTS_TOPIC, {
        type: 'ACTUALIZADA',
        slot: { ...slot, status: 'RESERVADA' },
      });
    });
    await waitFor(() => {
      expect(announcements()).toHaveTextContent(
        'Un paciente reservó tu franja del miércoles, 23 de septiembre de 10:00 a 10:50.',
      );
    });
    // La franja cambia de key con su estado: la versión anterior sale con su animación.
    await waitFor(() => {
      expect(wednesday().getByText('10:00 – 10:50').nextElementSibling).toHaveTextContent(
        'Reservada',
      );
    });

    act(() => {
      publishMockEvent(SLOTS_TOPIC, { type: 'ACTUALIZADA', slot });
    });
    await waitFor(() => {
      expect(announcements()).toHaveTextContent(
        'Se liberó tu franja del miércoles, 23 de septiembre de 10:00 a 10:50.',
      );
    });
  });

  it('ignora eventos de otros psicólogos, de otras semanas y mensajes mal formados', async () => {
    await openAvailability();
    const slot = seededSlot(new Date(2026, 8, 23, 10));

    act(() => {
      publishMockEvent(SLOTS_TOPIC, {
        type: 'ELIMINADA',
        slot: { ...slot, psychologistId: 'otro' },
      });
      publishMockEvent(SLOTS_TOPIC, { type: 'BORRADA', slot });
      publishMockEvent(SLOTS_TOPIC, {
        type: 'CREADA',
        slot: {
          ...slot,
          id: 'franja-futura',
          startsAt: new Date(2026, 9, 7, 10).toISOString(),
          endsAt: new Date(2026, 9, 7, 11).toISOString(),
        },
      });
      publishMockEvent(SLOTS_TOPIC, {
        type: 'CREADA',
        slot: { ...slot, id: 'franja-nueva-control' },
      });
    });

    // El evento de control (válido) confirma que los anteriores ya se procesaron.
    await waitFor(() => {
      expect(wednesday().getAllByText('10:00 – 10:50')).toHaveLength(2);
    });
    expect(wednesday().getAllByRole('listitem')).toHaveLength(8);
  });

  it('muestra el estado de la conexión y recupera lo perdido al reconectar', async () => {
    const { client, store } = controlledRealtimeClient();
    const requests = vi.fn();
    server.events.on('request:start', ({ request }) => {
      if (request.url.includes(MY_SLOTS_ENDPOINT)) {
        requests();
      }
    });
    await openAvailability(() => client);
    const badge = screen.getByRole('status', { name: 'Conexión en tiempo real' });
    expect(badge).toHaveTextContent('En línea');

    act(() => {
      store.set('reconnecting');
    });
    await waitFor(() => {
      expect(badge).toHaveTextContent('Reconectando');
    });

    // Mientras no había conexión, un paciente reservó una franja y el evento se perdió.
    const db = readWellbeingDb();
    const slot = seededSlot(new Date(2026, 8, 23, 10));
    db.slots = db.slots.map((candidate) =>
      candidate.id === slot.id ? { ...candidate, status: 'RESERVADA' } : candidate,
    );
    writeWellbeingDb(db);
    const before = requests.mock.calls.length;

    act(() => {
      store.set('connected');
    });

    await waitFor(() => {
      expect(requests.mock.calls.length).toBeGreaterThan(before);
    });
    await waitFor(() => {
      expect(wednesday().getByText('10:00 – 10:50').nextElementSibling).toHaveTextContent(
        'Reservada',
      );
    });
    server.events.removeAllListeners();
  });

  it('la franja creada aquí no se duplica cuando llega su propio evento', async () => {
    server.use(http.get(`*${MY_SLOTS_ENDPOINT}`, () => HttpResponse.json([]), { once: false }));
    storeSession('PSICOLOGO');
    const { user } = renderRoute(PSYCHOLOGIST_PATHS.availability);
    const form = within(await screen.findByRole('region', { name: 'Abrir franja' }));

    await user.selectOptions(form.getByLabelText('Desde'), '12:00');
    await user.selectOptions(form.getByLabelText('Hasta'), '13:00');
    await user.click(form.getByRole('button', { name: 'Abrir franja' }));

    expect(await wednesday().findByText('12:00 – 13:00')).toBeInTheDocument();

    // El evento de control sale después del propio: cuando se ve, el propio ya se procesó.
    const created = seededSlot(new Date(2026, 8, 23, 12));
    act(() => {
      publishMockEvent(SLOTS_TOPIC, {
        type: 'CREADA',
        slot: {
          ...created,
          id: 'franja-control',
          startsAt: new Date(2026, 8, 23, 14).toISOString(),
          endsAt: new Date(2026, 8, 23, 15).toISOString(),
        },
      });
    });
    expect(await wednesday().findByText('14:00 – 15:00')).toBeInTheDocument();
    expect(wednesday().getAllByText('12:00 – 13:00')).toHaveLength(1);
  });
});
