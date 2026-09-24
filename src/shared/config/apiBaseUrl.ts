/** Usa la URL configurada del API Gateway o, si no hay, el mismo origen del frontend. */
export function resolveApiBaseUrl(configured: string | undefined, fallbackOrigin: string): string {
  if (configured === undefined || configured.trim() === '') {
    return fallbackOrigin;
  }
  return configured;
}

export const API_BASE_URL = resolveApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL,
  window.location.origin,
);
