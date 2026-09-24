import type { PanInfo } from 'motion/react';

/** Distancia (px) o velocidad (px/s) hacia la izquierda que cierra el menú móvil al arrastrarlo. */
export const DRAWER_CLOSE_OFFSET_PX = 80;
export const DRAWER_CLOSE_VELOCITY_PX_S = 500;

/** Gesto nativo: deslizar el menú hacia la izquierda lo cierra, igual que en una app móvil. */
export function isDismissGesture({ offset, velocity }: Pick<PanInfo, 'offset' | 'velocity'>) {
  return offset.x < -DRAWER_CLOSE_OFFSET_PX || velocity.x < -DRAWER_CLOSE_VELOCITY_PX_S;
}
