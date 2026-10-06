import { projectPath, workshopPath } from '@/app/paths';
import type { Project } from '@/features/projects/model/project';
import { closingOf, spotsLabel } from '@/features/projects/model/project';
import type { Workshop } from '@/features/workshops/model/workshop';
import { capacityLabel, describeSchedule, hasStarted } from '@/features/workshops/model/workshop';
import { availableSpots } from '@/shared/spots/spots';
import type { ToastInput } from '@/shared/ui/Toast/toast';

/** Aviso de una convocatoria que se acaba de abrir: un proyecto o un taller. */
export interface OpenCallAnnouncement {
  /** Identifica la convocatoria para anunciarla una sola vez, aunque el evento llegue repetido. */
  key: string;
  toast: ToastInput;
}

/** Proyecto nuevo con cupos: enlaza a su detalle. `null` si ya no se puede postular. */
export function projectAnnouncement(project: Project, now: number): OpenCallAnnouncement | null {
  const closing = closingOf(project.closesAt, now);
  if (closing.closed || availableSpots(project) === 0) {
    return null;
  }
  return {
    key: `proyecto:${project.id}`,
    toast: {
      tone: 'info',
      title: `Convocatoria abierta: ${project.title}`,
      message: `${spotsLabel(project)}. ${closing.label}.`,
      action: { label: 'Ver proyecto', to: projectPath(project.id) },
    },
  };
}

/** Taller nuevo con capacidad: enlaza al taller. `null` si ya empezó o no tiene cupos. */
export function workshopAnnouncement(workshop: Workshop, now: number): OpenCallAnnouncement | null {
  if (hasStarted(workshop, now) || workshop.occupied >= workshop.capacity) {
    return null;
  }
  return {
    key: `taller:${workshop.id}`,
    toast: {
      tone: 'info',
      title: `Convocatoria abierta: ${workshop.title}`,
      message: `${describeSchedule(workshop)}. ${capacityLabel(workshop.capacity)}.`,
      action: { label: 'Ver taller', to: workshopPath(workshop.id) },
    },
  };
}
