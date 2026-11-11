import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { MicrosoftLogo } from '@/features/auth/components/MicrosoftLogo';
import { isRecord } from '@/features/auth/model/session';
import { request } from '@/shared/api/httpClient';
import { pageNavigation } from '@/shared/lib/pageNavigation';
import { Button } from '@/shared/ui/Button/Button';
import { SEED_USERS } from '../seedUsers';
import { MICROSOFT_SIMULATOR_ENDPOINT, UNREGISTERED_ACCOUNT } from './handlers';
import styles from './MicrosoftSimulatorPage.module.css';

const ACCOUNTS = [
  ...SEED_USERS.map(({ email, fullName }) => ({ email, fullName })),
  { email: UNREGISTERED_ACCOUNT, fullName: 'Cuenta sin acceso a ZEAL' },
];

/**
 * Solo en el simulador: reemplaza a login.microsoftonline.com. Elegir una cuenta hace lo que hará
 * el callback del backend (tarea 484) y vuelve a la app como lo haría su redirección.
 */
export function MicrosoftSimulatorPage() {
  const [params] = useSearchParams();
  const state = params.get('state') ?? '';
  const [sending, setSending] = useState(false);

  async function choose(email: string | null) {
    setSending(true);
    const answer = await request(MICROSOFT_SIMULATOR_ENDPOINT, {
      method: 'POST',
      body: { state, email },
      withRefreshCookie: true,
    }).catch(() => null);
    const redirectTo =
      isRecord(answer) && typeof answer.redirectTo === 'string'
        ? answer.redirectTo
        : '/login?error=fallo';
    pageNavigation.assign(redirectTo);
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="simulador-titulo">
        <p className={styles.brand}>
          <MicrosoftLogo />
          Microsoft
        </p>
        <h1 id="simulador-titulo" className={styles.title}>
          Elige una cuenta
        </h1>
        <p className={styles.note}>
          Simulador de desarrollo: con el backend real aquí está login.microsoftonline.com.
        </p>
        <ul className={styles.accounts}>
          {ACCOUNTS.map(({ email, fullName }) => (
            <li key={email}>
              <button
                type="button"
                className={styles.account}
                disabled={sending}
                onClick={() => void choose(email)}
              >
                <span className={styles.name}>{fullName}</span>
                <span className={styles.email}>{email}</span>
              </button>
            </li>
          ))}
        </ul>
        <Button variant="outline" disabled={sending} onClick={() => void choose(null)}>
          Cancelar
        </Button>
      </section>
    </main>
  );
}
