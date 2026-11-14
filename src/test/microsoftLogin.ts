import { screen, waitFor } from '@testing-library/react';
import { expect, vi } from 'vitest';
import { sessionStore } from '@/features/auth/storage/sessionStore';
import type { RealtimeClientFactory } from '@/shared/realtime/realtimeClient';
import { pageNavigation } from '@/shared/lib/pageNavigation';
import { renderRoute } from './renderRoute';

type View = Awaited<ReturnType<typeof renderRoute>>;

/**
 * Espía la navegación fuera de la app (jsdom no carga otra página). Cada llamada a `leave` emula
 * esa recarga: desmonta la pantalla, la memoria de la pestaña se pierde y se abre la dirección.
 */
export function spyPageNavigation() {
  const assign = vi.spyOn(pageNavigation, 'assign').mockImplementation(() => undefined);
  return {
    assign,
    /** La `n`-ésima dirección a la que la app quiso navegar (desde 1). */
    async target(n = 1): Promise<string> {
      await waitFor(() => {
        expect(assign).toHaveBeenCalledTimes(n);
      });
      return assign.mock.calls[n - 1]?.[0] ?? '';
    },
    async leave(view: View, n: number, factory?: RealtimeClientFactory): Promise<View> {
      const url = await this.target(n);
      view.unmount();
      sessionStore.clear();
      return await renderRoute(url, factory);
    },
  };
}

/**
 * Inicia sesión con Microsoft de punta a punta en el simulador: el botón, el selector de cuentas
 * que reemplaza a Microsoft y el regreso a la app, que recupera la sesión con la cookie.
 */
export async function loginWithMicrosoft(
  view: View,
  email: string,
  { remember = false, factory }: { remember?: boolean; factory?: RealtimeClientFactory } = {},
): Promise<View> {
  const navigation = spyPageNavigation();
  if (remember) {
    await view.user.click(await screen.findByRole('checkbox', { name: 'Recordarme' }));
  }
  await view.user.click(
    await screen.findByRole('button', { name: 'Iniciar sesión con Microsoft' }),
  );
  const picker = await navigation.leave(view, 1, factory);
  await picker.user.click(await screen.findByRole('button', { name: new RegExp(email) }));
  const back = await navigation.leave(picker, 2, factory);
  navigation.assign.mockRestore();
  return back;
}
