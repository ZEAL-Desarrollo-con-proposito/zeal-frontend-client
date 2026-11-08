import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN_PATHS } from '@/app/paths';
import { publishToUser } from '@/mocks/realtime';
import { server } from '@/mocks/server';
import { readWorkshopsDb, writeWorkshopsDb } from '@/mocks/workshops/db';
import type { WorkshopRecord } from '@/mocks/workshops/db';
import { freezeTime } from '@/test/clock';
import { buildSession, seedUser, storeSession } from '@/test/credentials';
import { controlledRealtimeClient } from '@/test/realtime';
import { renderRoute } from '@/test/renderRoute';
import { takeDown } from '@/test/server';
import { keepOnlyAdminSeedWorkshop } from '@/test/workshops';
import { ADMIN_WORKSHOPS_ENDPOINT } from './api/adminWorkshopsApi';
import type { Workshop } from './model/workshop';
import { WORKSHOPS_QUEUE } from './model/workshopEvent';

const list = () => within(screen.getByRole('list', { name: 'Talleres publicados' }));
const form = () => within(screen.getByRole('region', { name: 'Publicar taller' }));
const announcements = () => screen.getByRole('status', { name: 'Avisos de talleres' });
const cardOf = (title: string) => within(list().getByRole('listitem', { name: title }));

type View = Awaited<ReturnType<typeof renderRoute>>;

async function openWorkshops() {
  storeSession('ADMIN');
  const view = await renderRoute(ADMIN_PATHS.workshops);
  await screen.findByRole('list', { name: 'Talleres publicados' });
  return view;
}

async function fillForm(user: View['user'], values: Partial<Record<string, string>> = {}) {
  const f = form();
  const data = {
    'Título del taller': 'Taller de respiración profunda',
    'Descripción del taller': 'Sesión guiada de respiración para bajar el ritmo en la jornada.',
    'Día del taller': '2026-10-10',
    'Hora de inicio': '15:00',
    'Duración (minutos)': '60',
    'Capacidad máxima': '25',
    ...values,
  };
  for (const [label, value] of Object.entries(data)) {
    if (value === '') continue;
    const field = f.getByLabelText(label);
    if (field.tagName === 'TEXTAREA') {
      await user.click(field);
      await user.paste(value);
    } else {
      await user.type(field, value);
    }
  }
}

const publish = (user: View['user']) =>
  user.click(form().getByRole('button', { name: 'Publicar taller' }));

/** El taller semilla, para clonarlo donde haga falta más de un registro. */
function seedWorkshop(): WorkshopRecord {
  const [seed] = readWorkshopsDb().workshops;
  if (seed === undefined) {
    throw new Error('Falta el taller semilla en la base de datos simulada');
  }
  return seed;
}

describe('Talleres del administrador · lista (HU-FE-15)', () => {
  beforeEach(() => {
    freezeTime();
    keepOnlyAdminSeedWorkshop();
  });

  it('muestra el taller de su empresa con horario, capacidad e inscritas', async () => {
    const db = readWorkshopsDb();
    db.workshops.push({
      ...seedWorkshop(),
      id: 'taller-otra-empresa',
      organization: 'Otra Empresa S.A.',
      title: 'Taller de otra empresa',
    });
    writeWorkshopsDb(db);
    await openWorkshops();

    const items = list().getAllByRole('listitem');
    expect(items).toHaveLength(1);
    const seed = cardOf('Pausas activas y respiración');
    expect(seed.getByText('Abierto')).toBeInTheDocument();
    expect(seed.getByText('Miércoles, 30 de septiembre · 15:00 – 16:00')).toBeInTheDocument();
    expect(seed.getByText('Capacidad para 30 personas · 12 inscritas')).toBeInTheDocument();
    expect(screen.queryByText('Taller de otra empresa')).not.toBeInTheDocument();
    const resumen = screen.getByRole('region', { name: 'Resumen' });
    expect(resumen).toHaveTextContent('Próximos1');
    expect(resumen).toHaveTextContent('Realizados0');
    expect(resumen).toHaveTextContent('1 taller publicado en total');
  });

  it('marca los talleres ya realizados y los que están llenos', async () => {
    const db = readWorkshopsDb();
    const seed = seedWorkshop();
    writeWorkshopsDb({
      ...db,
      workshops: [
        ...db.workshops,
        {
          ...seed,
          id: 'taller-pasado',
          title: 'Taller ya realizado',
          startsAt: new Date(2026, 8, 20, 15).toISOString(),
          publishedAt: new Date(2026, 8, 19).toISOString(),
          occupied: 30,
        },
        {
          ...seed,
          id: 'taller-lleno',
          title: 'Taller lleno',
          startsAt: new Date(2026, 9, 20, 15).toISOString(),
          publishedAt: new Date(2026, 8, 22).toISOString(),
          occupied: 30,
        },
      ],
    });
    await openWorkshops();

    expect(cardOf('Taller ya realizado').getByText('Realizado')).toBeInTheDocument();
    expect(cardOf('Taller lleno').getByText('Sin cupos')).toBeInTheDocument();
    const resumen = screen.getByRole('region', { name: 'Resumen' });
    expect(resumen).toHaveTextContent('Próximos2');
    expect(resumen).toHaveTextContent('Realizados1');
    expect(resumen).toHaveTextContent('3 talleres publicados en total');
  });

  it('explica el estado vacío', async () => {
    writeWorkshopsDb({ workshops: [], enrollments: [], sequence: 0 });
    storeSession('ADMIN');
    await renderRoute(ADMIN_PATHS.workshops);

    expect(await screen.findByText('Todavía no has publicado talleres')).toBeInTheDocument();
  });

  it('permite reintentar si la carga falla', async () => {
    const bringBack = takeDown(ADMIN_WORKSHOPS_ENDPOINT);
    storeSession('ADMIN');
    const { user } = await renderRoute(ADMIN_PATHS.workshops);

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar los talleres.');
    bringBack();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('list', { name: 'Talleres publicados' })).toBeInTheDocument();
  });

  it('un empleado no accede a la pantalla de talleres del administrador', async () => {
    storeSession('EMPLEADO');
    await renderRoute(ADMIN_PATHS.workshops);

    expect(screen.queryByRole('region', { name: 'Publicar taller' })).not.toBeInTheDocument();
  });

  it('si el servidor responde 403, la pantalla se reemplaza por "Permiso denegado"', async () => {
    server.use(
      http.get(`*${ADMIN_WORKSHOPS_ENDPOINT}`, () =>
        HttpResponse.json(
          { status: 403, error: 'Forbidden', message: 'No tienes permiso para esta operación.' },
          { status: 403 },
        ),
      ),
    );
    storeSession('ADMIN');
    await renderRoute(ADMIN_PATHS.workshops);

    expect(
      await screen.findByRole('heading', { name: 'Esta sección no está disponible para tu rol' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Publicar taller' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
  });

  it('resume en plural cuando hay más de un taller', async () => {
    const db = readWorkshopsDb();
    const seed = seedWorkshop();
    writeWorkshopsDb({
      ...db,
      workshops: [
        ...db.workshops,
        {
          ...seed,
          id: 'taller-segundo',
          title: 'Segundo taller',
          startsAt: new Date(2026, 9, 20, 10).toISOString(),
          publishedAt: new Date(2026, 8, 23, 8).toISOString(),
        },
      ],
    });
    await openWorkshops();

    expect(screen.getByText('2 talleres publicados en total')).toBeInTheDocument();
    expect(list().getAllByRole('listitem')).toHaveLength(2);
    expect(list().getAllByRole('listitem')[0]).toHaveTextContent('Segundo taller');
  });
});

describe('Talleres del administrador · publicar (HU-FE-15)', () => {
  beforeEach(() => {
    freezeTime();
    keepOnlyAdminSeedWorkshop();
  });

  afterEach(() => {
    server.events.removeAllListeners();
  });

  it('valida los campos obligatorios, no envía y enfoca el primero inválido', async () => {
    const { user } = await openWorkshops();

    await publish(user);

    expect(form().getByLabelText('Título del taller')).toHaveAccessibleDescription(
      'Escribe el título del taller',
    );
    expect(form().getByLabelText('Descripción del taller')).toHaveAccessibleDescription(
      'Máx. 600 caracteres Describe de qué trata el taller',
    );
    expect(form().getByLabelText('Día del taller')).toHaveAccessibleDescription(
      'Elige el día del taller',
    );
    expect(form().getByLabelText('Hora de inicio')).toHaveAccessibleDescription(
      'Indica la hora de inicio',
    );
    expect(form().getByLabelText('Duración (minutos)')).toHaveAccessibleDescription(
      'Indica cuánto dura el taller, en minutos',
    );
    expect(form().getByLabelText('Capacidad máxima')).toHaveAccessibleDescription(
      'Indica cuántas personas caben en el taller',
    );
    expect(form().getByLabelText('Título del taller')).toHaveFocus();
    expect(list().getAllByRole('listitem')).toHaveLength(1);
  });

  it.each([
    ['0', 'El taller necesita capacidad para al menos 1 persona'],
    ['2.5', 'La capacidad debe ser un número entero'],
    ['201', 'El máximo es 200 personas por taller'],
  ])('explica la capacidad inválida %j al salir del campo', async (capacity, message) => {
    const { user } = await openWorkshops();

    await user.type(form().getByLabelText('Capacidad máxima'), capacity);
    await user.tab();

    expect(form().getByLabelText('Capacidad máxima')).toHaveAccessibleDescription(message);
  });

  it.each([
    ['10', 'El taller debe durar al menos 15 minutos'],
    ['241', 'El taller puede durar hasta 240 minutos'],
  ])('explica la duración inválida %j al salir del campo', async (duration, message) => {
    const { user } = await openWorkshops();

    await user.type(form().getByLabelText('Duración (minutos)'), duration);
    await user.tab();

    expect(form().getByLabelText('Duración (minutos)')).toHaveAccessibleDescription(message);
  });

  it('explica el día pasado y la hora que ya pasó', async () => {
    const { user } = await openWorkshops();

    await user.type(form().getByLabelText('Día del taller'), '2026-09-01');
    await user.tab();
    expect(form().getByLabelText('Día del taller')).toHaveAccessibleDescription(
      'El taller no puede ser en un día pasado',
    );

    await user.clear(form().getByLabelText('Día del taller'));
    await user.type(form().getByLabelText('Día del taller'), '2026-09-23');
    await user.type(form().getByLabelText('Hora de inicio'), '08:00');
    await user.tab();
    expect(form().getByLabelText('Hora de inicio')).toHaveAccessibleDescription(
      'La hora de inicio debe ser posterior a este momento',
    );
  });

  it('publica el taller: aparece primero, se anuncia y se limpia el formulario', async () => {
    const { user } = await openWorkshops();
    await fillForm(user);

    await publish(user);

    await waitFor(() => {
      expect(list().getAllByRole('listitem')[0]).toHaveTextContent(
        'Taller de respiración profunda',
      );
    });
    expect(list().getAllByRole('listitem')).toHaveLength(2);
    const created = cardOf('Taller de respiración profunda');
    expect(created.getByText('Abierto')).toBeInTheDocument();
    expect(created.getByText('Sábado, 10 de octubre · 15:00 – 16:00')).toBeInTheDocument();
    expect(created.getByText('Capacidad para 25 personas · 0 inscritas')).toBeInTheDocument();
    expect(announcements()).toHaveTextContent(
      'Publicaste el taller «Taller de respiración profunda».',
    );
    expect(form().getByLabelText('Título del taller')).toHaveValue('');
    expect(form().queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Resumen' })).toHaveTextContent(
      '2 talleres publicados en total',
    );
  });

  it('muestra el rechazo del servidor y conserva lo escrito', async () => {
    const { user } = await openWorkshops();
    await fillForm(user, { 'Título del taller': 'Pausas activas y respiración' });

    await publish(user);

    expect(await form().findByRole('alert')).toHaveTextContent(
      'Ya tienes un taller próximo con ese título',
    );
    expect(form().getByLabelText('Capacidad máxima')).toHaveValue('25');
    expect(list().getAllByRole('listitem')).toHaveLength(1);
  });

  it('avisa si no hay conexión y bloquea el botón mientras envía', async () => {
    let release: () => void = () => undefined;
    server.use(
      http.post(`*${ADMIN_WORKSHOPS_ENDPOINT}`, async () => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return HttpResponse.error();
      }),
    );
    const { user } = await openWorkshops();
    await fillForm(user);

    await publish(user);

    expect(form().getByRole('button', { name: 'Publicando…' })).toBeDisabled();
    release();
    expect(await form().findByRole('alert')).toHaveTextContent(
      'No pudimos conectar con ZEAL. Revisa tu conexión e intenta de nuevo.',
    );
  });

  it('no reenvía mientras la primera publicación sigue en curso', async () => {
    const released: (() => void)[] = [];
    server.use(
      http.post(`*${ADMIN_WORKSHOPS_ENDPOINT}`, async () => {
        await new Promise<void>((resolve) => {
          released.push(resolve);
        });
        return HttpResponse.error();
      }),
    );
    const posts: string[] = [];
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'POST') {
        posts.push(new URL(request.url).pathname);
      }
    });
    const { user } = await openWorkshops();
    await fillForm(user);

    await publish(user);

    expect(form().getByRole('button', { name: 'Publicando…' })).toBeDisabled();
    const formElement = screen
      .getByRole('region', { name: 'Publicar taller' })
      .getElementsByTagName('form')[0];
    if (formElement === undefined) {
      throw new Error('El formulario de publicación no está en pantalla');
    }
    fireEvent.submit(formElement);
    released.forEach((resolve) => {
      resolve();
    });

    expect(await form().findByRole('alert')).toHaveTextContent(
      'No pudimos conectar con ZEAL. Revisa tu conexión e intenta de nuevo.',
    );
    expect(posts).toHaveLength(1);
    expect(list().getAllByRole('listitem')).toHaveLength(1);
  });
});

describe('Talleres del administrador · en tiempo real', () => {
  beforeEach(() => {
    freezeTime();
    keepOnlyAdminSeedWorkshop();
  });

  const remote: Workshop = {
    id: 'taller-remoto',
    title: 'Publicado desde otra sesión',
    description: 'Lo publicó otra persona del equipo de talento humano.',
    startsAt: new Date(2026, 9, 15, 10).toISOString(),
    durationMinutes: 45,
    publishedAt: new Date(2026, 8, 23, 9, 19).toISOString(),
    capacity: 20,
    occupied: 0,
    version: 1,
  };

  it('muestra al instante un taller publicado desde otra sesión y lo anuncia', async () => {
    await openWorkshops();

    act(() => {
      publishToUser(seedUser('ADMIN').id, WORKSHOPS_QUEUE, { type: 'PUBLICADO', workshop: remote });
    });

    expect(await list().findByText('Publicado desde otra sesión')).toBeInTheDocument();
    expect(announcements()).toHaveTextContent(
      'Se publicó el taller «Publicado desde otra sesión».',
    );
  });

  it('ignora mensajes mal formados y no duplica lo que publicó esta sesión', async () => {
    const { user } = await openWorkshops();
    act(() => {
      publishToUser(seedUser('ADMIN').id, WORKSHOPS_QUEUE, {
        type: 'PUBLICADO',
        workshop: { id: 'x' },
      });
    });
    await fillForm(user);
    await publish(user);
    await list().findByText('Taller de respiración profunda');
    expect(announcements()).toHaveTextContent('Publicaste el taller');

    // El aviso de control sale después del eco de lo publicado aquí: cuando aparece, el eco ya
    // se procesó.
    act(() => {
      publishToUser(seedUser('ADMIN').id, WORKSHOPS_QUEUE, { type: 'PUBLICADO', workshop: remote });
    });
    await list().findByText('Publicado desde otra sesión');

    expect(list().getAllByRole('listitem')).toHaveLength(3);
  });

  it('vuelve a pedir la lista al recuperar la conexión', async () => {
    const { client, store } = controlledRealtimeClient();
    storeSession('ADMIN');
    await renderRoute(ADMIN_PATHS.workshops, () => client);
    await screen.findByRole('list', { name: 'Talleres publicados' });

    // Mientras no había conexión otra sesión publicó un taller y el aviso se perdió.
    await fetch(new URL(ADMIN_WORKSHOPS_ENDPOINT, window.location.origin), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buildSession('ADMIN').accessToken}`,
      },
      body: JSON.stringify({
        title: 'Publicado sin conexión',
        description: 'Se publicó mientras la conexión estaba caída.',
        startsAt: new Date(2026, 9, 20, 10).toISOString(),
        durationMinutes: 45,
        capacity: 12,
      }),
    });
    act(() => {
      store.set('reconnecting');
    });
    act(() => {
      store.set('connected');
    });

    expect(await list().findByText('Publicado sin conexión')).toBeInTheDocument();
  });
});
