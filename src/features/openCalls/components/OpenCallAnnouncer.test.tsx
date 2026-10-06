import { act, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { EMPLOYEE_PATHS } from '@/app/paths';
import { AuthProvider } from '@/features/auth/context/AuthProvider';
import type { ProjectDetail } from '@/features/projects/model/project';
import { organizationProjectsTopic } from '@/features/projects/model/projectCatalogEvent';
import type { Workshop } from '@/features/workshops/model/workshop';
import { organizationWorkshopsTopic } from '@/features/workshops/model/workshopEvent';
import { freezeTime } from '@/test/clock';
import { storeSession } from '@/test/credentials';
import { scriptedRealtimeClient } from '@/test/realtime';
import { renderRoute } from '@/test/renderRoute';
import { OpenCallAnnouncer } from './OpenCallAnnouncer';

const ORGANIZATION = 'Nexura S.A.S.';

const WORKSHOP: Workshop = {
  id: 'taller-respiracion',
  title: 'Taller de respiración',
  description: 'Una sesión práctica para respirar mejor durante la jornada.',
  startsAt: new Date(2026, 8, 30, 15).toISOString(),
  durationMinutes: 60,
  publishedAt: new Date(2026, 8, 23, 9).toISOString(),
  capacity: 25,
  occupied: 0,
  version: 1,
};

const PROJECT: ProjectDetail = {
  id: 'proyecto-guardia-datos',
  title: 'Data Platform · Turno de guardia',
  area: 'Datos',
  cohort: 'Rotación trimestral',
  summary: 'Acompañar el oncall con un mentor durante 6 semanas.',
  description: ['Acompañar el oncall con un mentor durante la rotación.'],
  requirements: ['Manejo básico de logs y métricas'],
  skills: ['Observabilidad'],
  capacity: 4,
  occupied: 2,
  version: 7,
  closesAt: new Date(2026, 8, 26, 14, 20).toISOString(),
};

function openAsEmployee() {
  storeSession('EMPLEADO');
  const realtime = scriptedRealtimeClient();
  const view = renderRoute(EMPLOYEE_PATHS.projects, () => realtime.client);
  return { ...view, realtime };
}

function toasts() {
  return within(screen.getByRole('region', { name: 'Avisos' }));
}

describe('OpenCallAnnouncer (HU-FE-15, Task 373)', () => {
  beforeEach(() => {
    freezeTime();
  });

  it('anuncia un taller recién publicado y enlaza a su detalle', async () => {
    const { realtime } = openAsEmployee();
    await screen.findByRole('listitem', { name: 'Data Platform · Turno de guardia' });

    act(() => {
      realtime.deliver(organizationWorkshopsTopic(ORGANIZATION), {
        type: 'PUBLICADO',
        workshop: WORKSHOP,
      });
    });

    expect(
      await toasts().findByText('Convocatoria abierta: Taller de respiración'),
    ).toBeInTheDocument();
    expect(
      toasts().getByText(
        'Miércoles, 30 de septiembre · 15:00 – 16:00. Capacidad para 25 personas.',
      ),
    ).toBeInTheDocument();
    expect(toasts().getByRole('link', { name: 'Ver taller' })).toHaveAttribute(
      'href',
      '/empleado/talleres?taller=taller-respiracion',
    );

    // El aviso repetido no se vuelve a mostrar.
    act(() => {
      realtime.deliver(organizationWorkshopsTopic(ORGANIZATION), {
        type: 'PUBLICADO',
        workshop: WORKSHOP,
      });
    });
    expect(toasts().getAllByRole('listitem')).toHaveLength(1);
  });

  it('anuncia un proyecto abierto con sus cupos y su enlace', async () => {
    const { realtime } = openAsEmployee();
    await screen.findByRole('listitem', { name: 'Data Platform · Turno de guardia' });

    act(() => {
      realtime.deliver(organizationProjectsTopic(ORGANIZATION), {
        type: 'PUBLICADO',
        project: PROJECT,
      });
    });

    expect(
      await toasts().findByText('Convocatoria abierta: Data Platform · Turno de guardia'),
    ).toBeInTheDocument();
    expect(toasts().getByText('Quedan 2 de 4 cupos. Cierra en 3 días.')).toBeInTheDocument();
    expect(toasts().getByRole('link', { name: 'Ver proyecto' })).toHaveAttribute(
      'href',
      '/empleado/proyectos/proyecto-guardia-datos',
    );

    act(() => {
      realtime.deliver(organizationProjectsTopic(ORGANIZATION), {
        type: 'PUBLICADO',
        project: PROJECT,
      });
    });
    expect(toasts().getAllByRole('listitem')).toHaveLength(1);
  });

  it('ignora lo que ya empezó, lo lleno y los mensajes mal formados', async () => {
    const { realtime } = openAsEmployee();
    await screen.findByRole('listitem', { name: 'Data Platform · Turno de guardia' });
    const workshopsTopic = organizationWorkshopsTopic(ORGANIZATION);
    const projectsTopic = organizationProjectsTopic(ORGANIZATION);

    act(() => {
      realtime.deliver(workshopsTopic, {
        type: 'PUBLICADO',
        workshop: { ...WORKSHOP, startsAt: new Date(2026, 8, 23, 8).toISOString() },
      });
      realtime.deliver(workshopsTopic, {
        type: 'PUBLICADO',
        workshop: { ...WORKSHOP, occupied: 25 },
      });
      realtime.deliver(workshopsTopic, { type: 'PUBLICADO', workshop: { id: 'x' } });
      realtime.deliver(workshopsTopic, { type: 'OTRO', workshop: WORKSHOP });
      realtime.deliver(organizationWorkshopsTopic('Otra Empresa S.A.'), {
        type: 'PUBLICADO',
        workshop: WORKSHOP,
      });
      realtime.deliver(projectsTopic, {
        type: 'PUBLICADO',
        project: { ...PROJECT, closesAt: new Date(2026, 8, 20).toISOString() },
      });
      realtime.deliver(projectsTopic, { type: 'PUBLICADO', project: { ...PROJECT, occupied: 4 } });
      realtime.deliver(projectsTopic, { type: 'PUBLICADO', project: { id: 'x' } });
      realtime.deliver(projectsTopic, { type: 'OTRO', project: PROJECT });
    });

    expect(screen.queryByText(/Convocatoria abierta/)).not.toBeInTheDocument();
  });

  it('sin sesión no anuncia nada', () => {
    const { container } = render(
      <AuthProvider>
        <OpenCallAnnouncer />
      </AuthProvider>,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
