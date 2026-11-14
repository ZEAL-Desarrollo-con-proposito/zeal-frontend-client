import { sendTelemetry } from './telemetryApi';

/** Un tramo de menos de este tiempo es un paso por la pantalla, no una interacción. */
export const MIN_INTERACTION_MS = 1000;

/** Tope de un tramo: una pestaña olvidada abierta no debe inflar el tiempo promedio. */
export const MAX_INTERACTION_SECONDS = 1800;

/**
 * Eventos de navegación que se proponen a HU-BE-25 para el tablero de negocio ("funcionalidades
 * más usadas" y "tiempo promedio de interacción"). Solo llevan la ruta saneada y segundos.
 */
export type NavigationEvent =
  { type: 'vista'; route: string } | { type: 'interaccion'; route: string; seconds: number };

export interface NavigationReport {
  events: NavigationEvent[];
}

interface NavigationTelemetryDependencies {
  send: (report: NavigationReport) => Promise<void>;
  now: () => number;
  isVisible: () => boolean;
}

/**
 * Vistas de cada sección y tiempo de interacción con la pantalla visible. Va en un reporte aparte
 * del uso (`usageTelemetry`): si el backend aún no acepta estos eventos, no arrastra los demás.
 * Una vista se envía junto con el tiempo de la pantalla anterior al navegar, o al ocultarse la
 * pestaña; solo cuenta el tiempo con la pestaña visible.
 */
export function createNavigationTelemetry({
  send,
  now,
  isVisible,
}: NavigationTelemetryDependencies) {
  let route: string | null = null;
  /** Desde cuándo se está viendo la pantalla; `null` si la pestaña está oculta. */
  let visibleSince: number | null = null;
  let visibleMs = 0;
  const pending: NavigationEvent[] = [];

  /** Suma al tiempo de la pantalla el tramo visible que corría hasta ahora. */
  function closeVisibleSpan(): void {
    if (visibleSince !== null) {
      visibleMs += now() - visibleSince;
      visibleSince = null;
    }
  }

  function recordInteraction(): void {
    closeVisibleSpan();
    if (route !== null && visibleMs >= MIN_INTERACTION_MS) {
      const seconds = Math.min(MAX_INTERACTION_SECONDS, Math.round(visibleMs / 1000));
      pending.push({ type: 'interaccion', route, seconds });
    }
    visibleMs = 0;
  }

  function flush(): void {
    if (pending.length === 0) {
      return;
    }
    // Una medición perdida no justifica más tráfico: no se reintenta el reporte.
    void send({ events: pending.splice(0) }).catch(() => undefined);
  }

  return {
    /** La persona llegó a una pantalla; `undefined` si no es una ruta que se reporte. */
    enter(next: string | undefined): void {
      recordInteraction();
      route = next ?? null;
      if (route !== null) {
        pending.push({ type: 'vista', route });
        visibleSince = isVisible() ? now() : null;
      }
    },
    /** La persona dejó la pantalla (navegó a otra o cerró sesión): se envía lo acumulado. */
    leave(): void {
      recordInteraction();
      route = null;
      flush();
    },
    /** La pestaña se ocultó: se envía lo acumulado y el tiempo deja de correr. */
    hide(): void {
      recordInteraction();
      flush();
    },
    /** La pestaña volvió a verse: el tiempo de la pantalla actual vuelve a correr. */
    show(): void {
      if (route !== null) {
        visibleSince = now();
      }
    },
  };
}

const navigationTelemetry = createNavigationTelemetry({
  send: (report) => sendTelemetry(report, { keepalive: true }),
  now: () => Date.now(),
  isVisible: () => document.visibilityState === 'visible',
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    navigationTelemetry.hide();
  } else {
    navigationTelemetry.show();
  }
});

export function trackView(route: string | undefined): void {
  navigationTelemetry.enter(route);
}

export function stopTrackingViews(): void {
  navigationTelemetry.leave();
}
