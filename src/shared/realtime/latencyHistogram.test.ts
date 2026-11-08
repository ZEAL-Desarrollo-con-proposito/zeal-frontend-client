import { describe, expect, it } from 'vitest';
import { createLatencyHistogram } from './latencyHistogram';

describe('histograma de latencia', () => {
  it('cuenta cada medición en su límite y en los mayores, como `le` en Prometheus', () => {
    const histogram = createLatencyHistogram();

    histogram.record('talleres/cupos:CUPOS', 500);
    histogram.record('talleres/cupos:CUPOS', 501);
    histogram.record('talleres/cupos:CUPOS', 12_000);

    expect(histogram.drain()).toEqual({
      type: 'LATENCIA_EN_VIVO',
      series: [
        {
          event: 'talleres/cupos:CUPOS',
          count: 3,
          sumMs: 13_001,
          maxMs: 12_000,
          le: {
            '50': 0,
            '100': 0,
            '250': 0,
            '500': 1,
            '1000': 2,
            '2500': 2,
            '5000': 2,
            '10000': 2,
            '+Inf': 3,
          },
        },
      ],
    });
  });

  it('separa los tipos de evento y empieza de cero en cada ventana', () => {
    const histogram = createLatencyHistogram();
    histogram.record('franjas:CREADA', 20);
    histogram.record('notificaciones:NUEVA', 80);

    expect(histogram.drain()?.series.map(({ event, count }) => [event, count])).toEqual([
      ['franjas:CREADA', 1],
      ['notificaciones:NUEVA', 1],
    ]);
    expect(histogram.drain()).toBeNull();
  });
});
