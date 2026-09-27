import { createContext } from 'react';

export type ToastTone = 'success' | 'info' | 'warning';

/** Acción opcional de un aviso (p. ej. "Ver mis citas"). */
export interface ToastAction {
  label: string;
  to: string;
}

export interface ToastInput {
  title: string;
  message?: string;
  tone?: ToastTone;
  action?: ToastAction;
}

export interface Toast {
  id: number;
  title: string;
  tone: ToastTone;
  message?: string;
  action?: ToastAction;
}

/** Tiempo en pantalla de un aviso (3-5 s según las guías); se pausa mientras se lee. */
export const TOAST_DURATION_MS = 5000;

/** Máximo de avisos visibles a la vez: el más antiguo sale para que no tapen la pantalla. */
export const MAX_VISIBLE_TOASTS = 3;

export type ShowToast = (toast: ToastInput) => void;

export const ToastContext = createContext<ShowToast | null>(null);

/** Agrega un aviso al final y descarta los más antiguos si se pasa del máximo. */
export function enqueueToast(toasts: readonly Toast[], toast: Toast): Toast[] {
  return [...toasts, toast].slice(-MAX_VISIBLE_TOASTS);
}
