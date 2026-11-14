/** Cabecera que el backend usa como `correlationId` de punta a punta (R2-29 / HU-FE-25). */
export const REQUEST_ID_HEADER = 'X-Request-Id';

/**
 * Identificador seguro para `X-Request-Id`: el backend lo acepta si cumple
 * `^[A-Za-z0-9._-]{8,64}$`. El UUID que genera el navegador siempre cumple esa forma.
 */
export function newRequestId(): string {
  return crypto.randomUUID();
}
