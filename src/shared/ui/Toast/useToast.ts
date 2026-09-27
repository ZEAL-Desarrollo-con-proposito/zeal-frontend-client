import { use } from 'react';
import type { ShowToast } from './toast';
import { ToastContext } from './toast';

/** Muestra un aviso emergente. Fuera del proveedor (p. ej. en pruebas aisladas) no hace nada. */
export function useToast(): ShowToast {
  return use(ToastContext) ?? ignoreToast;
}

function ignoreToast() {
  // Sin proveedor no hay dónde mostrar avisos.
}
