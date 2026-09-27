import { act, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { EMPLOYEE_PATHS, psychologistPath } from '@/app/paths';
import type { Slot } from '@/features/availability/model/slot';
import type { SlotEvent } from '@/features/availability/model/slotEvent';
import { SLOTS_TOPIC } from '@/features/availability/model/slotEvent';
import { publishMockEvent } from '@/mocks/realtime';
import { server } from '@/mocks/server';
import { readWellbeingDb, SEED_PSYCHOLOGIST_ID, writeWellbeingDb } from '@/mocks/wellbeing/db';
import { controlClock, freezeTime, jumpTo } from '@/test/clock';
import { storeSession } from '@/test/credentials';
import { renderRoute } from '@/test/renderRoute';
import { PSYCHOLOGISTS_ENDPOINT } from '../api/directoryApi';

const LAURA = psychologistPath(SEED_PSYCHOLOGIST_ID);
const WEDNESDAY = 'Bloques libres del miércoles, 23 de septiembre';
const wednesdayAt = (hour: number, minute = 0) => new Date(2026, 8, 23, hour, minute);

function openProfile(path = LAURA) {
  storeSession('EMPLEADO');
  return renderRoute(path);
}

/** Horarios de un día, una vez que la semana terminó de cargar. */
async function blocksOf(dayLabel: string) {
  const day = await screen.findByRole('list', { name: dayLabel });
  await waitFor(() => {
    expect(screen.getByRole('region', { name: 'Bloques libres' })).toHaveAttribute(
      'aria-busy',
      'false',
    );
  });
  return within(day)
    .queryAllByRole('listitem')
    .map((item) => item.textContent);
}

function notices() {
  return screen.getByRole('status', { name: 'Avisos de bloques' });
}

/** Franja semilla de Laura que empieza a esa hora. */
function lauraSlotAt(start: Date): Slot {
  const slot = readWellbeingDb().slots.find(
    (candidate) =>
      candidate.psychologistId === SEED_PSYCHOLOGIST_ID &&
      candidate.startsAt === start.toISOString(),
  );
  if (slot === undefined) {
    throw new Error('Franja semilla no encontrada');
  }
  return slot;
}

/** Laura (en otra sesión) cambia su agenda: el servidor guarda y publica el evento. */
function serverPublishes(event: SlotEvent) {
  const db = readWellbeingDb();
  db.slots = db.slots.filter(({ id }) => id !== event.slot.id);
  if (event.type !== 'ELIMINADA') {
    db.slots.push(event.slot);
  }
  writeWellbeingDb(db);
  act(() => {
    publishMockEvent(SLOTS_TOPIC, event);
  });
}

describe('Perfil del psicólogo · bloques libres (HU-FE-04)', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('muestra quién es, en qué acompaña y cuándo tiene su próximo bloque', async () => {
    openProfile();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Laura Martínez' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Psicóloga clínica')).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Temas que acompaña' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Ansiedad laboral', 'Burnout']);
    expect(screen.getByText('Disponible hoy')).toBeInTheDocument();
    expect(screen.getByText('Próximo bloque libre: Hoy · 10:00')).toBeInTheDocument();

    const breadcrumb = within(screen.getByRole('navigation', { name: 'Ruta de navegación' }));
    expect(breadcrumb.getByText('Laura Martínez')).toHaveAttribute('aria-current', 'page');
    expect(document.title).toBe('Perfil del psicólogo · ZEAL');
    expect(
      within(screen.getByRole('navigation', { name: 'Navegación principal' })).getByRole('link', {
        name: 'Bienestar',
      }),
    ).toHaveAttribute('aria-current', 'page');

    const privacy = within(screen.getByRole('region', { name: 'Nadie más lo sabe' }));
    expect(
      privacy.getByText(/Ni Nexura S\.A\.S\. ni tu líder sabrán que reservaste con Laura/),
    ).toBeInTheDocument();
  });

  it('muestra los bloques libres de la semana por día, sin los que ya pasaron', async () => {
    openProfile();

    expect(await blocksOf(WEDNESDAY)).toEqual(['10:00 – 10:50', '14:00 – 14:50', '15:00 – 15:50']);
    expect(await blocksOf('Bloques libres del jueves, 24 de septiembre')).toHaveLength(5);
    expect(await blocksOf('Bloques libres del lunes, 21 de septiembre')).toEqual([]);
    expect(screen.getAllByText('Ya pasó')).toHaveLength(2);
    expect(screen.getByText('Hoy')).toBeInTheDocument();
  });

  it('navega entre semanas', async () => {
    const { router, user } = openProfile();
    await blocksOf(WEDNESDAY);

    await user.click(screen.getByRole('button', { name: 'Semana siguiente' }));

    expect(router.state.location.search).toBe('?semana=2026-09-28');
    expect(await blocksOf('Bloques libres del lunes, 28 de septiembre')).toEqual([
      '9:00 – 9:50',
      '10:00 – 10:50',
      '14:00 – 14:50',
      '15:00 – 15:50',
    ]);
  });

  it('ofrece ver la semana siguiente cuando esta no tiene bloques libres', async () => {
    const { user } = openProfile(psychologistPath('usr-psicologo-003'));

    expect(await screen.findByText('No hay bloques libres esta semana.')).toBeInTheDocument();
    expect(screen.getByText('Agenda llena')).toBeInTheDocument();
    expect(screen.getByText('Próximo bloque libre: Lun 28 · 9:00')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ver semana siguiente' }));

    expect(await blocksOf('Bloques libres del lunes, 28 de septiembre')).toEqual([
      '9:00 – 9:50',
      '11:00 – 11:50',
      '15:00 – 15:50',
    ]);
    expect(screen.queryByText('No hay bloques libres esta semana.')).not.toBeInTheDocument();
  });

  it('retira un bloque que empieza mientras se mira la semana', async () => {
    controlClock(wednesdayAt(9, 55));
    openProfile();
    expect(await blocksOf(WEDNESDAY)).toContain('10:00 – 10:50');

    jumpTo(wednesdayAt(10));

    await waitFor(() => {
      expect(
        within(screen.getByRole('list', { name: WEDNESDAY })).queryByText('10:00 – 10:50'),
      ).toBeNull();
    });
  });

  it('vuelve al directorio con los filtros con los que se abrió el perfil', async () => {
    const { router, user } = openProfile(`${EMPLOYEE_PATHS.wellbeing}?tema=Burnout`);

    await user.click(
      await screen.findByRole('link', { name: 'Ver disponibilidad de Laura Martínez' }),
    );
    await screen.findByRole('heading', { level: 1, name: 'Laura Martínez' });
    await user.click(
      within(screen.getByRole('navigation', { name: 'Ruta de navegación' })).getByRole('link', {
        name: 'Bienestar',
      }),
    );

    expect(router.state.location.pathname).toBe(EMPLOYEE_PATHS.wellbeing);
    expect(router.state.location.search).toBe('?tema=Burnout');
    expect(await screen.findByRole('button', { name: 'Burnout' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('avisa si el psicólogo no está en el directorio', async () => {
    const { router, user } = openProfile(psychologistPath('nadie'));

    expect(
      await screen.findByRole('heading', { name: 'No encontramos a este psicólogo' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Volver al directorio' }));

    expect(router.state.location.pathname).toBe(EMPLOYEE_PATHS.wellbeing);
  });

  it('permite reintentar si el perfil no carga', async () => {
    server.use(
      http.get(`*${PSYCHOLOGISTS_ENDPOINT}/:id`, () => new HttpResponse(null, { status: 500 }), {
        once: true,
      }),
    );
    const { user } = openProfile();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No pudimos cargar el perfil.');

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Laura Martínez' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('permite reintentar si los bloques no cargan', async () => {
    server.use(
      http.get(
        `*${PSYCHOLOGISTS_ENDPOINT}/:id/franjas`,
        () => new HttpResponse(null, { status: 500 }),
        { once: true },
      ),
    );
    const { user } = openProfile();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No pudimos cargar los bloques libres.');

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(await blocksOf(WEDNESDAY)).toHaveLength(3);
  });
});

describe('Perfil del psicólogo · en tiempo real (RT-2)', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('retira al instante un bloque que otra persona reservó, y lo avisa', async () => {
    openProfile();
    await blocksOf(WEDNESDAY);
    const slot = lauraSlotAt(wednesdayAt(14));

    serverPublishes({ type: 'ACTUALIZADA', slot: { ...slot, status: 'RESERVADA' } });

    await waitFor(() => {
      expect(notices()).toHaveTextContent(
        'Alguien acaba de reservar el bloque del miércoles, 23 de septiembre de 14:00 a 14:50.',
      );
    });
    await waitFor(async () => {
      expect(await blocksOf(WEDNESDAY)).toEqual(['10:00 – 10:50', '15:00 – 15:50']);
    });

    serverPublishes({ type: 'ACTUALIZADA', slot });

    await waitFor(() => {
      expect(notices()).toHaveTextContent('Se liberó el bloque del miércoles, 23 de septiembre');
    });
    expect(await blocksOf(WEDNESDAY)).toContain('14:00 – 14:50');
  });

  it('muestra un bloque nuevo y retira uno eliminado, con el perfil al día', async () => {
    openProfile();
    await blocksOf(WEDNESDAY);

    serverPublishes({
      type: 'CREADA',
      slot: {
        id: 'franja-nueva',
        psychologistId: SEED_PSYCHOLOGIST_ID,
        startsAt: wednesdayAt(12).toISOString(),
        endsAt: wednesdayAt(12, 50).toISOString(),
        status: 'DISPONIBLE',
      },
    });
    await waitFor(async () => {
      expect(await blocksOf(WEDNESDAY)).toEqual([
        '10:00 – 10:50',
        '12:00 – 12:50',
        '14:00 – 14:50',
        '15:00 – 15:50',
      ]);
    });
    expect(notices()).toHaveTextContent('Se abrió un bloque nuevo el miércoles, 23 de septiembre');

    serverPublishes({ type: 'ELIMINADA', slot: lauraSlotAt(wednesdayAt(10)) });

    await waitFor(() => {
      expect(screen.getByText('Próximo bloque libre: Hoy · 12:00')).toBeInTheDocument();
    });
    expect(await blocksOf(WEDNESDAY)).not.toContain('10:00 – 10:50');
    expect(notices()).toHaveTextContent('Se retiró el bloque del miércoles, 23 de septiembre');
  });

  it('no avisa cambios de otros psicólogos ni de otras semanas', async () => {
    openProfile();
    await blocksOf(WEDNESDAY);
    const nextWeek = lauraSlotAt(new Date(2026, 8, 28, 9));

    act(() => {
      publishMockEvent(SLOTS_TOPIC, {
        type: 'ELIMINADA',
        slot: { ...lauraSlotAt(wednesdayAt(15)), psychologistId: 'usr-psicologo-002' },
      });
      publishMockEvent(SLOTS_TOPIC, { type: 'ELIMINADA', slot: nextWeek });
    });
    // Un evento de control confirma que los anteriores ya se procesaron.
    serverPublishes({ type: 'ACTUALIZADA', slot: lauraSlotAt(wednesdayAt(14)) });

    await waitFor(() => {
      expect(notices()).toHaveTextContent('Se liberó el bloque del miércoles');
    });
    expect(await blocksOf(WEDNESDAY)).toContain('15:00 – 15:50');
  });
});
