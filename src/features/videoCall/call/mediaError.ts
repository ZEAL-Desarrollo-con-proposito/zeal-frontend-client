import { isRecord } from '@/features/auth/model/session';

/** Por qué no se pudo encender la cámara o el micrófono. */
export type MediaErrorReason = 'denied' | 'not-found' | 'busy' | 'unsupported' | 'unknown';

export const MEDIA_ERROR_MESSAGES: Record<MediaErrorReason, { title: string; detail: string }> = {
  denied: {
    title: 'Permite el acceso a tu cámara y micrófono',
    detail:
      'Tu navegador bloqueó el permiso. Actívalo desde el candado de la barra de direcciones y vuelve a intentarlo.',
  },
  'not-found': {
    title: 'No encontramos cámara o micrófono',
    detail: 'Conecta uno a tu equipo y vuelve a intentarlo.',
  },
  busy: {
    title: 'Tu cámara está en uso',
    detail: 'Cierra la otra aplicación que la esté usando y vuelve a intentarlo.',
  },
  unsupported: {
    title: 'Este navegador no permite videollamadas aquí',
    detail: 'Abre ZEAL en un navegador actualizado y con conexión segura (https).',
  },
  unknown: {
    title: 'No pudimos encender tu cámara',
    detail: 'Vuelve a intentarlo en un momento.',
  },
};

const REASONS_BY_ERROR: Partial<Record<string, MediaErrorReason>> = {
  NotAllowedError: 'denied',
  SecurityError: 'denied',
  NotFoundError: 'not-found',
  OverconstrainedError: 'not-found',
  NotReadableError: 'busy',
  AbortError: 'busy',
  NotSupportedError: 'unsupported',
};

/** El navegador rechaza la cámara con un `DOMException`; su `name` dice el motivo. */
export function mediaErrorReason(error: unknown): MediaErrorReason {
  const name = isRecord(error) && typeof error.name === 'string' ? error.name : '';
  return REASONS_BY_ERROR[name] ?? 'unknown';
}
