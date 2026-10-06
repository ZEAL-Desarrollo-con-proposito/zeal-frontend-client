import { useRef } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  isProjectPublishedEvent,
  organizationProjectsTopic,
} from '@/features/projects/model/projectCatalogEvent';
import {
  isWorkshopPublishedEvent,
  organizationWorkshopsTopic,
} from '@/features/workshops/model/workshopEvent';
import { useRealtimeSubscription } from '@/shared/realtime/useRealtime';
import { useToast } from '@/shared/ui/Toast/useToast';
import type { OpenCallAnnouncement } from '../model/openCallAnnouncement';
import { projectAnnouncement, workshopAnnouncement } from '../model/openCallAnnouncement';

/**
 * Avisa al empleado conectado cuando su empresa abre una convocatoria nueva (HU-FE-15): un aviso
 * emergente con el enlace al proyecto o al taller.
 */
export function OpenCallAnnouncer() {
  const { session } = useAuth();
  const organization = session?.user.organization ?? '';
  const showToast = useToast();
  /** Convocatorias ya anunciadas: si el evento llega dos veces, se avisa una sola. */
  const announced = useRef(new Set<string>());

  function announce(announcement: OpenCallAnnouncement | null) {
    if (announcement === null || announced.current.has(announcement.key)) {
      return;
    }
    announced.current.add(announcement.key);
    showToast(announcement.toast);
  }

  useRealtimeSubscription(organizationProjectsTopic(organization), (payload) => {
    if (isProjectPublishedEvent(payload)) {
      announce(projectAnnouncement(payload.project, Date.now()));
    }
  });

  useRealtimeSubscription(organizationWorkshopsTopic(organization), (payload) => {
    if (isWorkshopPublishedEvent(payload)) {
      announce(workshopAnnouncement(payload.workshop, Date.now()));
    }
  });

  return null;
}
