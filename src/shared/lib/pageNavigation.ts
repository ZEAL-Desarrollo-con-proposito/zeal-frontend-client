/**
 * Navegación fuera de la app que recarga la página (p. ej. al inicio de sesión de Microsoft). Es
 * un objeto para que las pruebas la reemplacen: jsdom no navega entre documentos.
 */
export const pageNavigation = {
  assign: (url: string): void => {
    window.location.assign(url);
  },
};
