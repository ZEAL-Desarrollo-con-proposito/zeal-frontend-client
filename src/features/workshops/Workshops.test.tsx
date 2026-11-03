import { act, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { EMPLOYEE_PATHS, ROLE_HOME_PATH, workshopPath } from '@/app/paths';
import { SEED_ORGANIZATION } from '@/mocks/seedUsers';
import { server } from '@/mocks/server';
import { updateWorkshopOccupied } from '@/mocks/workshops/db';
import { controlClock, freezeTime, jumpTo } from '@/test/clock';
import { storeSession } from '@/test/credentials';
import { scriptedRealtimeClient } from '@/test/realtime';
import { renderRoute } from '@/test/renderRoute';
import { WORKSHOPS_ENDPOINT } from './api/workshopsApi';
import type { Workshop } from './model/workshop';
import { organizationWorkshopsTopic, workshopTopic } from './model/workshopEvent';

const IMPOSTOR = 'taller-impostor';
const IMPOSTOR_TITLE = 'Síndrome del impostor en tu primer empleo';
const MALESTAR_TITLE = 'Gestión del malestar en equipos ágiles';

function openAsEmployee(scripted = false) {
  storeSession('EMPLEADO');
  const realtime = scriptedRealtimeClient();
  const view = renderRoute(EMPLOYEE_PATHS.workshops, scripted ? () => realtime.client : undefined);
  return { ...view, realtime };
}

async function cardOf(title: string) {
  return within(await screen.findByRole('listitem', { name: title }));
}

async function featured(title = MALESTAR_TITLE) {
  return within(await screen.findByRole('article', { name: title }));
}

function spotsEvent(occupied: number, version: number, workshopId = IMPOSTOR) {
  return { type: 'CUPOS', workshopId, capacity: 30, occupied, version };
}

function workshop(overrides: Partial<Workshop> = {}): Workshop {
  return {
    id: 'taller-unico',
    title: 'Respiración para días intensos',
    description: 'Técnicas breves para bajar el ritmo entre reuniones.',
    capacity: 10,
    occupied: 4,
    version: 1,
    startsAt: new Date(2026, 8, 25, 9).toISOString(),
    durationMinutes: 60,
    publishedAt: new Date(2026, 8, 23, 9).toISOString(),
    ...overrides,
  };
}

describe('Catálogo de talleres (HU-FE-18)', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('se llega desde el menú: el próximo taller destacado y el resto con sus cupos', async () => {
    storeSession('EMPLEADO');
    const { user, router } = renderRoute(ROLE_HOME_PATH.EMPLEADO);

    await user.click(
      within(screen.getByRole('complementary', { name: 'Barra lateral' })).getByRole('link', {
        name: 'Talleres',
      }),
    );

    expect(router.state.location.pathname).toBe(EMPLOYEE_PATHS.workshops);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Talleres comunitarios' }),
    ).toBeInTheDocument();
    const hero = await featured();
    expect(hero.getByText('Empieza en 45 min')).toBeInTheDocument();
    expect(hero.getByText('Hoy · 10:05 · 50 min')).toBeInTheDocument();
    expect(hero.getByText(/Facilita Gabriela Muñoz/)).toBeInTheDocument();
    expect(hero.getByText('12 / 30 cupos')).toBeInTheDocument();
    expect(hero.getByRole('button', { name: `Inscribirme a ${MALESTAR_TITLE}` })).toBeEnabled();

    const impostor = await cardOf(IMPOSTOR_TITLE);
    expect(impostor.getByText('Últimos cupos')).toBeInTheDocument();
    expect(impostor.getByText('Mañana · 12:30 · 60 min')).toBeInTheDocument();
    expect(impostor.getByText('29 / 30 cupos')).toBeInTheDocument();
    expect(impostor.getByText('97%')).toBeInTheDocument();
    expect(impostor.getByRole('button', { name: `Inscribirme a ${IMPOSTOR_TITLE}` })).toBeEnabled();
    expect(screen.getAllByRole('listitem', { name: /./ })).toHaveLength(7);
    // Ni los que ya empezaron ni los de otra empresa.
    expect(screen.queryByText('Yoga de escritorio')).not.toBeInTheDocument();
    expect(screen.queryByText('Taller de otra empresa')).not.toBeInTheDocument();
  });

  it('un taller lleno no deja inscribirse y dice por qué', async () => {
    openAsEmployee();

    const full = await cardOf('Límites sanos y desconexión digital');

    expect(full.getByText('Cupos agotados')).toBeInTheDocument();
    expect(full.getByText('30 / 30 cupos')).toBeInTheDocument();
    const button = full.getByRole('button', { name: 'Inscribirme' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('Este taller ya no tiene cupos.');
  });

  it('los cupos cambian en vivo: al llenarse se deshabilita y si se libera vuelve a ofrecerse', async () => {
    const { realtime, subscribedTo } = openAsEmployee(true);
    const impostor = await cardOf(IMPOSTOR_TITLE);
    await subscribedTo(workshopTopic(IMPOSTOR));

    act(() => {
      realtime.deliver(workshopTopic(IMPOSTOR), updateWorkshopOccupied(IMPOSTOR, 30));
    });
    expect(await impostor.findByText('Cupos agotados')).toBeInTheDocument();
    expect(impostor.getByText('30 / 30 cupos')).toBeInTheDocument();
    expect(impostor.getByRole('button', { name: 'Inscribirme' })).toBeDisabled();

    act(() => {
      realtime.deliver(workshopTopic(IMPOSTOR), updateWorkshopOccupied(IMPOSTOR, 20));
    });
    expect(await impostor.findByText('Con cupo')).toBeInTheDocument();
    expect(impostor.getByText('67%')).toBeInTheDocument();
    expect(impostor.getByRole('button', { name: `Inscribirme a ${IMPOSTOR_TITLE}` })).toBeEnabled();
  });

  it('descarta los avisos atrasados, los de otro taller y los que no son del contrato', async () => {
    const { realtime, subscribedTo } = openAsEmployee(true);
    const impostor = await cardOf(IMPOSTOR_TITLE);
    await subscribedTo(workshopTopic(IMPOSTOR));

    act(() => {
      realtime.deliver(workshopTopic(IMPOSTOR), spotsEvent(30, 3));
      realtime.deliver(workshopTopic(IMPOSTOR), spotsEvent(10, 2));
      realtime.deliver(workshopTopic(IMPOSTOR), spotsEvent(0, 9, 'otro'));
      realtime.deliver(workshopTopic(IMPOSTOR), { type: 'CUPOS' });
    });

    expect(await impostor.findByText('30 / 30 cupos')).toBeInTheDocument();
  });

  it('al recuperar la conexión vuelve a pedir los talleres para no perder cambios', async () => {
    const { realtime } = openAsEmployee(true);
    const impostor = await cardOf(IMPOSTOR_TITLE);

    act(() => {
      realtime.store.set('reconnecting');
    });
    // Sin conexión, el aviso del servidor se pierde.
    updateWorkshopOccupied(IMPOSTOR, 30);
    act(() => {
      realtime.store.set('connected');
    });

    expect(await impostor.findByText('30 / 30 cupos')).toBeInTheDocument();
  });

  it('un taller que publica el administrador aparece al instante, sin repetirse', async () => {
    const { realtime, subscribedTo } = openAsEmployee(true);
    await cardOf(IMPOSTOR_TITLE);
    const published = workshop({ id: 'taller-en-vivo', title: 'Taller recién publicado' });
    const topic = organizationWorkshopsTopic(SEED_ORGANIZATION);
    await subscribedTo(topic);

    act(() => {
      realtime.deliver(topic, { type: 'PUBLICADO', workshop: published });
      realtime.deliver(topic, { type: 'PUBLICADO', workshop: published });
      realtime.deliver(topic, { type: 'PUBLICADO', workshop: {} });
    });

    const card = await cardOf('Taller recién publicado');
    expect(card.getByText('Vie 25 · 9:00 · 60 min')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem', { name: /./ })).toHaveLength(8);
  });

  it('el enlace a un taller lo destaca (p. ej. desde el aviso de uno recién publicado)', async () => {
    storeSession('EMPLEADO');
    renderRoute(workshopPath('taller-descanso-real'));

    const hero = await featured('Descanso real: dormir en semana de release');

    expect(hero.getByText('8 / 25 cupos')).toBeInTheDocument();
    expect(await cardOf(MALESTAR_TITLE)).toBeTruthy();
  });

  it('si el taller empieza con la página abierta, se cierran sus inscripciones', async () => {
    controlClock();
    openAsEmployee();
    const hero = await featured();

    jumpTo(new Date(2026, 8, 23, 10, 5));

    expect(await hero.findByText('En curso')).toBeInTheDocument();
    expect(hero.getByRole('button', { name: 'Inscripciones cerradas' })).toBeDisabled();
  });

  it('sin talleres en la próxima hora, el destacado no lleva aviso de inicio', async () => {
    server.use(http.get(`*${WORKSHOPS_ENDPOINT}`, () => HttpResponse.json([workshop()])));
    openAsEmployee();

    const hero = await featured('Respiración para días intensos');

    expect(hero.getByText('Vie 25 · 9:00 · 60 min')).toBeInTheDocument();
    expect(hero.queryByText(/Empieza en/)).not.toBeInTheDocument();
    expect(screen.queryByRole('listitem', { name: /./ })).not.toBeInTheDocument();
  });

  it('sin talleres próximos lo explica', async () => {
    server.use(http.get(`*${WORKSHOPS_ENDPOINT}`, () => HttpResponse.json([])));
    openAsEmployee();

    expect(
      await screen.findByRole('heading', { name: 'No hay talleres próximos' }),
    ).toBeInTheDocument();
  });

  it('si no carga, permite reintentar', async () => {
    server.use(
      http.get(`*${WORKSHOPS_ENDPOINT}`, () => HttpResponse.json({}, { status: 500 }), {
        once: true,
      }),
    );
    const { user } = openAsEmployee();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No pudimos cargar los talleres.');

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(await featured()).toBeTruthy();
  });
});
