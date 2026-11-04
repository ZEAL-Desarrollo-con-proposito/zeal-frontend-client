import { useRouteError } from 'react-router';
import { isForbidden, isNotFound } from '@/shared/api/errors';
import { ForbiddenPage } from './ForbiddenPage';
import { NotFoundPage } from './NotFoundPage';

/**
 * Frontera de las pantallas de un rol: si el servidor no entrega lo que una pantalla carga, esa
 * pantalla se reemplaza, sin nada de su contenido. Un 404 se muestra como "no encontrada": el
 * servidor oculta el recurso (SEG-2) y la interfaz tampoco confirma que exista. Cualquier otro
 * error sigue hacia la frontera de la raíz.
 */
export function AccessBoundary() {
  const error = useRouteError();
  if (isForbidden(error)) {
    return <ForbiddenPage />;
  }
  if (isNotFound(error)) {
    return <NotFoundPage />;
  }
  throw error;
}
