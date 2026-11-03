import userEvent from '@testing-library/user-event';

/**
 * Persona usuaria de las pruebas, sin pausa real entre tecla y tecla (`delay: null`). Con la pausa
 * por defecto (un `setTimeout` por acción), escribir un formulario largo tarda segundos y, con la
 * CPU ocupada, mucho más.
 */
export function setupUser() {
  return userEvent.setup({ delay: null });
}
