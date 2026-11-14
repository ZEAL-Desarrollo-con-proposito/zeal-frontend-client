import { useEffect } from 'react';
import { stopTrackingViews, trackView } from '@/shared/telemetry/navigationTelemetry';
import { telemetryRoute } from '@/shared/telemetry/telemetryRoute';

/**
 * Reporta la vista de cada sección y cuánto tiempo se interactúa con ella (HU-FE-25). Al cambiar
 * de ruta o al cerrar sesión (cuando el layout se desmonta) cierra la pantalla anterior.
 */
export function useNavigationTelemetry(pathname: string): void {
  useEffect(() => {
    trackView(telemetryRoute(pathname));
    return stopTrackingViews;
  }, [pathname]);
}
