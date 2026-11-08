/**
 * Límites superiores (ms) de los grupos del histograma, como `le` en Prometheus. El de 500 ms es
 * la meta del escenario REND-1 (p95 de 500 ms o menos).
 */
export const LATENCY_BOUNDS_MS = [50, 100, 250, 500, 1000, 2500, 5000, 10_000] as const;

/** Mediciones de un tipo de evento en una ventana de tiempo. */
export interface LatencySeries {
  /** Recurso y tipo del evento, p. ej. `organizaciones/talleres:PUBLICADO`. */
  event: string;
  count: number;
  sumMs: number;
  maxMs: number;
  /**
   * Cuántas mediciones quedaron en cada límite o por debajo (acumulado, como `le` en Prometheus);
   * `+Inf` las cuenta todas. Así el servidor suma los histogramas de todos los navegadores.
   */
  le: Record<string, number>;
}

export interface LatencyReport {
  type: 'LATENCIA_EN_VIVO';
  series: LatencySeries[];
}

/** Agrega las mediciones en el navegador: se envía un resumen por ventana, no cada evento. */
export function createLatencyHistogram() {
  const series = new Map<string, Omit<LatencySeries, 'event'>>();

  return {
    record(event: string, ms: number): void {
      const current = series.get(event) ?? { count: 0, sumMs: 0, maxMs: 0, le: {} };
      const count = current.count + 1;
      series.set(event, {
        count,
        sumMs: current.sumMs + ms,
        maxMs: Math.max(current.maxMs, ms),
        le: {
          ...Object.fromEntries(
            LATENCY_BOUNDS_MS.map((bound) => {
              const key = String(bound);
              return [key, (current.le[key] ?? 0) + (ms <= bound ? 1 : 0)];
            }),
          ),
          '+Inf': count,
        },
      });
    },

    /** Entrega lo acumulado y empieza una ventana nueva; `null` si no hubo mediciones. */
    drain(): LatencyReport | null {
      if (series.size === 0) {
        return null;
      }
      const report: LatencyReport = {
        type: 'LATENCIA_EN_VIVO',
        series: [...series].map(([event, accumulated]) => ({ event, ...accumulated })),
      };
      series.clear();
      return report;
    },
  };
}
