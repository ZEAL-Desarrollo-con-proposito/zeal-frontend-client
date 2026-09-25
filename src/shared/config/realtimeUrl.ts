/** Endpoint SockJS del Real-Time Gateway (puerto 8083 según la guía de arquitectura). */
export const DEFAULT_REALTIME_URL = 'http://localhost:8083/ws';

export function resolveRealtimeUrl(configured: string | undefined): string {
  if (configured === undefined || configured.trim() === '') {
    return DEFAULT_REALTIME_URL;
  }
  return configured;
}
