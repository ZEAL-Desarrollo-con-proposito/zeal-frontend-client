import { useSearchParams } from 'react-router';

export const VIEW_PARAM = 'vista';

export const APPOINTMENT_VIEWS = ['proximas', 'historial', 'canceladas'] as const;

export type AppointmentView = (typeof APPOINTMENT_VIEWS)[number];

function isAppointmentView(value: string | null): value is AppointmentView {
  return APPOINTMENT_VIEWS.some((view) => view === value);
}

/** Pestaña de "Mis citas" guardada en la URL (`?vista=historial`); sin valor válido, Próximas. */
export function useAppointmentsView(): [AppointmentView, (view: AppointmentView) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get(VIEW_PARAM);
  const view = isAppointmentView(requested) ? requested : 'proximas';

  function setView(next: AppointmentView) {
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        params.set(VIEW_PARAM, next);
        return params;
      },
      { replace: true },
    );
  }

  return [view, setView];
}
