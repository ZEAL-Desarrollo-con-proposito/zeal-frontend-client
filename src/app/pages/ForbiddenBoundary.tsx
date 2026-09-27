import { useRouteError } from 'react-router';
import { isForbidden } from '@/shared/api/errors';
import { ForbiddenPage } from './ForbiddenPage';

/**
 * Frontera de las pantallas de un rol: si el servidor niega el acceso (403) a lo que una pantalla
 * carga, se muestra "Permiso denegado" en su lugar, sin nada de su contenido. Cualquier otro error
 * sigue hacia la frontera de la raíz.
 */
export function ForbiddenBoundary() {
  const error = useRouteError();
  if (!isForbidden(error)) {
    throw error;
  }
  return <ForbiddenPage />;
}
