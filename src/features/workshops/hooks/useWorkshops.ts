import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { useLiveCollection } from '@/shared/realtime/useLiveCollection';
import { fetchWorkshops } from '../api/workshopsApi';
import type { Workshop } from '../model/workshop';
import { bySoonest } from '../model/workshop';
import { isWorkshopPublishedEvent, organizationWorkshopsTopic } from '../model/workshopEvent';

function readPublished(payload: unknown): Workshop | null {
  return isWorkshopPublishedEvent(payload) ? payload.workshop : null;
}

/**
 * Talleres próximos de la empresa (HU-FE-18), del más cercano al más lejano. Cuando el
 * administrador publica uno (HU-FE-15), aparece aquí sin recargar; al recuperar la conexión se
 * vuelven a pedir. Los cupos de cada uno siguen por su propio canal (`useWorkshopSpots`).
 */
export function useWorkshops() {
  const { organization } = useCurrentUser();
  const catalog = useLiveCollection({
    load: fetchWorkshops,
    queue: organizationWorkshopsTopic(organization),
    read: readPublished,
    compare: bySoonest,
  });
  return { status: catalog.status, workshops: catalog.items, reload: catalog.reload };
}
