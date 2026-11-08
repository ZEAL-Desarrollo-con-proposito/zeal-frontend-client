/**
 * Cookie de refresh simulada (HU-BE-22). El servidor real la pone httpOnly, Secure y
 * SameSite=Strict; desde el simulador no se puede, pero se comporta igual: la de sesión muere al
 * cerrar el navegador, rota en cada uso y reutilizar una ya rotada revoca toda la familia.
 */
const COOKIE_NAME = 'zeal_mock_refresh';
const FAMILIES_KEY = 'zeal.mock.familias';
const REMEMBER_SECONDS = 30 * 24 * 60 * 60;

interface Family {
  userId: string;
  version: number;
}

type Families = Record<string, Family>;

function readFamilies(): Families {
  return JSON.parse(localStorage.getItem(FAMILIES_KEY) ?? '{}') as Families;
}

function writeFamilies(families: Families): void {
  localStorage.setItem(FAMILIES_KEY, JSON.stringify(families));
}

function withoutFamily(families: Families, family: string): Families {
  return Object.fromEntries(Object.entries(families).filter(([id]) => id !== family));
}

function writeCookie(family: string, version: number, remember: boolean): void {
  const lifetime = remember ? `; Max-Age=${String(REMEMBER_SECONDS)}` : '';
  document.cookie = `${COOKIE_NAME}=${family}.${String(version)}.${String(remember)}; Path=/; SameSite=Strict${lifetime}`;
}

export interface RefreshCookie {
  family: string;
  version: number;
  remember: boolean;
}

/**
 * La cookie que viaja con una petición: el handler la lee al recibirla, antes de la latencia
 * simulada, como el servidor real lee la de la petición y no la que el navegador tenga después.
 */
export function readRefreshCookie(): RefreshCookie | null {
  const value = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  if (value === undefined) {
    return null;
  }
  const [family = '', version = '', remember = ''] = value.split('.');
  return { family, version: Number(version), remember: remember === 'true' };
}

export function forgetRefreshCookie(): void {
  document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0`;
}

export function startRefreshFamily(userId: string, remember: boolean): void {
  const family = crypto.randomUUID();
  writeFamilies({ ...readFamilies(), [family]: { userId, version: 1 } });
  writeCookie(family, 1, remember);
}

/**
 * Gasta la cookie de la petición y entrega otra. Devuelve de quién es; `null` si no sirve (y la
 * revoca si se reutilizó).
 */
export function rotateRefreshCookie(cookie: RefreshCookie | null): string | null {
  const families = readFamilies();
  const family = cookie === null ? undefined : families[cookie.family];
  if (cookie === null || family === undefined) {
    return null;
  }
  if (family.version !== cookie.version) {
    writeFamilies(withoutFamily(families, cookie.family));
    forgetRefreshCookie();
    return null;
  }
  const version = family.version + 1;
  writeFamilies({ ...families, [cookie.family]: { ...family, version } });
  writeCookie(cookie.family, version, cookie.remember);
  return family.userId;
}

/**
 * Revoca la familia de la cookie de la petición y la borra del navegador. Si mientras tanto se
 * abrió otra sesión (otra cookie), esa no se toca.
 */
export function revokeRefreshFamily(cookie: RefreshCookie | null): void {
  if (cookie === null) {
    return;
  }
  writeFamilies(withoutFamily(readFamilies(), cookie.family));
  if (readRefreshCookie()?.family === cookie.family) {
    forgetRefreshCookie();
  }
}
