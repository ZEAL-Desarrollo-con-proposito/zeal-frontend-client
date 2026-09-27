# zeal-frontend-client

Cliente web (SPA) de **ZEAL — Cuidado de la salud mental en el trabajo**, plataforma B2B SaaS de
bienestar emocional y desarrollo profesional.

## Stack

| Área                   | Herramienta                                                                 |
| ---------------------- | --------------------------------------------------------------------------- |
| UI                     | React 19 + TypeScript (modo estricto)                                       |
| Build y servidor local | Vite (puerto `3000`, según la guía de arquitectura)                         |
| Enrutamiento           | React Router                                                                |
| Animaciones            | Motion (antes Framer Motion)                                                |
| Estilos                | CSS Modules + tokens de marca (`src/styles/tokens.css`)                     |
| Pruebas                | Vitest + Testing Library, cobertura v8 con umbral del 100 %                 |
| Calidad                | ESLint (typescript-eslint estricto, SonarJS, jsx-a11y), Prettier, SonarQube |

## Primeros pasos

```bash
npm install
npm run dev
```

La aplicación queda en <http://localhost:3000>.

## Scripts

| Script                  | Qué hace                                                                  |
| ----------------------- | ------------------------------------------------------------------------- |
| `npm run dev`           | Servidor de desarrollo                                                    |
| `npm run build`         | Verifica tipos y genera el build de producción                            |
| `npm run lint`          | ESLint sin advertencias permitidas                                        |
| `npm run format`        | Formatea el código con Prettier                                           |
| `npm run test`          | Ejecuta las pruebas                                                       |
| `npm run test:coverage` | Pruebas con reporte de cobertura (`coverage/lcov.info` para SonarQube)    |
| `npm run verify`        | Tipos + lint + formato + pruebas con cobertura (lo mismo que corre el CI) |

## Estructura

```
src/
├── app/          # Composición: router, rutas, páginas de estado del sistema
├── features/     # Funcionalidades por dominio (auth, ...)
├── shared/       # Código reutilizable sin conocimiento de negocio (api, ui, lib)
├── mocks/        # API local simulado (MSW) para desarrollo y pruebas
├── assets/       # Íconos y gráficos exportados desde Figma
├── styles/       # Tokens de marca y estilos globales
└── test/         # Configuración y utilidades de pruebas
```

## API local simulado

Mientras el backend no esté disponible, el frontend usa [MSW](https://mswjs.io) para simular el
API: el mismo simulador sirve en desarrollo (Service Worker) y en las pruebas (Node). Se controla
con variables de entorno (ver `.env.example`):

| Variable            | Valor en desarrollo        | Uso                                                     |
| ------------------- | -------------------------- | ------------------------------------------------------- |
| `VITE_API_MOCKING`  | `enabled`                  | `disabled` para consumir el backend real                |
| `VITE_API_BASE_URL` | _(vacío)_                  | URL del API Gateway; vacío = mismo origen del frontend. |
| `VITE_REALTIME_URL` | `http://localhost:8083/ws` | Endpoint SockJS del Real-Time Gateway (sin simulador).  |

El build de producción nunca incluye el simulador.

### Usuarios semilla (HU-01)

El MVP no tiene registro: los usuarios vienen precargados. Contraseña de todos: `Zeal2026*`.

| Rol       | Correo                      | Llega a             |
| --------- | --------------------------- | ------------------- |
| Empleado  | `david.cajamarca@nexura.co` | `/empleado/inicio`  |
| Psicóloga | `laura.martinez@zeal.co`    | `/psicologo/agenda` |
| Admin     | `talento.humano@nexura.co`  | `/admin/panel`      |

### Contrato de autenticación (acordar con HU-BE-01)

`POST /api/auth/login`

```json
{ "email": "david.cajamarca@nexura.co", "password": "Zeal2026*" }
```

**200 OK**

```json
{
  "accessToken": "<JWT con sub, role, iat y exp>",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": {
    "id": "usr-empleado-001",
    "fullName": "David Cajamarca",
    "email": "david.cajamarca@nexura.co",
    "role": "EMPLEADO",
    "organization": "Nexura S.A.S."
  }
}
```

`role` ∈ `EMPLEADO`, `PSICOLOGO`, `ADMIN`.

**401 Unauthorized**

```json
{ "status": 401, "error": "Unauthorized", "message": "Correo o contraseña incorrectos" }
```

### Contrato de disponibilidad (acordar con HU-BE-02)

Todas las rutas exigen `Authorization: Bearer <token>` y rol `PSICOLOGO` (401 / 403). Las reglas de
negocio viven en el backend; el frontend muestra el `message` del error tal cual.

| Método y ruta                                                           | Respuesta                                                                |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `GET /api/wellbeing/franjas/mias?desde=AAAA-MM-DD&hasta=AAAA-MM-DD`     | `200` lista de franjas                                                   |
| `POST /api/wellbeing/franjas` con `{ "startsAt", "endsAt" }` (ISO 8601) | `201` franja · `400` horario inválido o pasado · `409` se cruza con otra |
| `DELETE /api/wellbeing/franjas/{id}`                                    | `204` · `404` ya no existe · `409` está reservada                        |

```json
{
  "id": "franja-16",
  "psychologistId": "usr-psicologo-001",
  "startsAt": "2026-09-23T14:00:00.000Z",
  "endsAt": "2026-09-23T14:50:00.000Z",
  "status": "DISPONIBLE"
}
```

`status` ∈ `DISPONIBLE`, `RESERVADA`.

### Contrato de agenda (acordar con HU-BE-03)

Mismas reglas de autenticación y rol `PSICOLOGO`. La ventana para entrar a la sala la fija el
servidor (en el simulador: desde 10 minutos antes del inicio hasta el fin de la sesión); el frontend
solo la compara con el reloj.

| Método y ruta                                                          | Respuesta                                  |
| ---------------------------------------------------------------------- | ------------------------------------------ |
| `GET /api/wellbeing/reservas/agenda?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` | `200` reservas del psicólogo, por inicio   |
| `GET /api/wellbeing/reservas/{id}`                                     | `200` reserva · `404` no existe o es ajena |

```json
{
  "id": "reserva-16",
  "employee": { "id": "usr-empleado-001", "fullName": "David Cajamarca" },
  "startsAt": "2026-09-23T14:00:00.000Z",
  "endsAt": "2026-09-23T14:50:00.000Z",
  "status": "CONFIRMADA",
  "joinOpensAt": "2026-09-23T13:50:00.000Z",
  "joinClosesAt": "2026-09-23T14:50:00.000Z"
}
```

`status` ∈ `CONFIRMADA`, `CANCELADA`, `FINALIZADA`. `joinOpensAt` y `joinClosesAt` son `null` si la
reserva no admite ingreso. Cuando una franja cambia de estado (`ACTUALIZADA` en `/topic/franjas`) la
agenda se vuelve a pedir.

### Contrato del directorio (acordar con HU-BE-04)

Rutas del rol `EMPLEADO`. Qué bloques se pueden reservar (disponibles y futuros) lo decide el
servidor; el frontend solo lee `nextFreeSlot` para mostrar "Disponible hoy" o el próximo día.

| Método y ruta                                                                  | Respuesta                                                                      |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `GET /api/wellbeing/psicologos`                                                | `200` psicólogos, primero quien tiene el bloque libre más próximo              |
| `GET /api/wellbeing/psicologos/{id}`                                           | `200` psicólogo · `404` no está en el directorio                               |
| `GET /api/wellbeing/psicologos/{id}/franjas?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` | `200` franjas futuras, libres u ocupadas, por inicio · `404` · `400` sin rango |

```json
{
  "id": "usr-psicologo-001",
  "fullName": "Laura Martínez",
  "title": "Psicóloga clínica",
  "focusAreas": ["Ansiedad laboral", "Burnout"],
  "nextFreeSlot": { "startsAt": "2026-09-23T15:00:00.000Z", "endsAt": "2026-09-23T15:50:00.000Z" }
}
```

`nextFreeSlot` es `null` si el psicólogo no tiene bloques libres. Cualquier evento de
`/topic/franjas` hace que el directorio se vuelva a pedir. La búsqueda (nombre, título o tema, sin
importar tildes) y los filtros se aplican en el cliente y se guardan en la URL (`?q=&tema=&hoy=1`).
En el perfil, los bloques de la semana (libres u ocupados, sin revelar quién reservó) se
actualizan con los eventos de ese psicólogo: un bloque reservado pasa a "Ocupado" al instante y se
avisa; si era el que el empleado había elegido, se suelta y se explica por qué, incluso con la
confirmación abierta. El perfil se vuelve a pedir para refrescar su próximo bloque.

### Contrato de reservas del empleado (acordar con HU-BE-05)

Rol `EMPLEADO`. La reserva es atómica en el servidor: validar el bloque y asignarlo ocurre como
una sola operación, así que un bloque nunca queda con dos citas.

| Método y ruta                                          | Respuesta                                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `POST /api/wellbeing/reservas` con `{ "slotId": "…" }` | `201` cita · `409` otra persona lo tomó o se cruza con otra cita · `404` · `400` ya empezó |

```json
{
  "id": "reserva-71",
  "psychologist": {
    "id": "usr-psicologo-001",
    "fullName": "Laura Martínez",
    "title": "Psicóloga clínica"
  },
  "startsAt": "2026-09-23T15:00:00.000Z",
  "endsAt": "2026-09-23T15:50:00.000Z",
  "status": "CONFIRMADA"
}
```

Al reservar, el servidor publica `ACTUALIZADA` en `/topic/franjas` con la franja ya `RESERVADA`.

## Tiempo real (RT-2)

- **Conexión:** STOMP sobre SockJS contra el Real-Time Gateway (`VITE_REALTIME_URL`, por defecto
  `http://localhost:8083/ws`), con `Authorization: Bearer <token>` en el frame `CONNECT`,
  reconexión automática cada 5 s y heartbeats de 10 s. La barra superior muestra el estado.
- **Destino `/topic/franjas`:** `{ "type": "CREADA" | "ELIMINADA" | "ACTUALIZADA", "slot": <franja> }`.
- **Concurrencia en el cliente:** los eventos que llegan mientras carga una semana se reaplican sobre
  la respuesta del servidor; una franja eliminada no reaparece por un evento atrasado; al
  recuperarse la conexión se vuelve a pedir la semana para no perder cambios.
- **Con el simulador:** el tiempo real se simula entre pestañas del mismo navegador. Para verlo,
  inicia sesión como psicóloga con "Recordarme", abre `/psicologo/disponibilidad` en dos pestañas y
  abre o elimina una franja en una de ellas.

## Sesión y seguridad

- **Rutas por rol:** cada rol vive bajo su prefijo (`/empleado`, `/psicologo`, `/admin`). Sin
  sesión, una ruta protegida manda al login; con la sesión de otro rol muestra "Permiso denegado"
  (aislamiento entre roles). La autorización real la aplica siempre el backend.
- **Token:** se envía como `Authorization: Bearer <token>`. El frontend solo lee el claim `exp`
  para cerrar la sesión al vencer; la firma la valida el servidor.
- **Almacenamiento:** sin "Recordarme" la sesión vive en `sessionStorage` (se borra al cerrar la
  pestaña); con "Recordarme", en `localStorage` y se sincroniza entre pestañas. Lo leído del
  almacenamiento se valida y se descarta si está alterado o vencido.
- **Cierre de sesión:** manual, por vencimiento del token o cuando el servidor responde 401.
- **Pendiente para producción:** Web Storage es accesible desde JavaScript; si el backend emite el
  token en una cookie `HttpOnly` + `SameSite`, el frontend puede dejar de guardarlo. Configurar
  también una Content-Security-Policy en el servidor que sirva el build.

## Identidad visual

Los colores, tipografías (Anton, Archivo, IBM Plex Mono) y radios vienen del **Manual de Identidad
ZEAL v1.0** y del Figma _ZEAL — Flujo de Pantallas (Desktop + Responsive)_. Regla de marca: los
colores de estado (salvia, malva, coral) expresan semántica, nunca navegación principal.

## Convención de ramas

- `main`: código estable para entregas.
- `develop`: integración diaria.
- `feature/<historia>`: una rama por historia de usuario (ej. `feature/HU-FE-01-login-navegacion-por-rol`).

Los commits referencian el work item de Azure Boards con `AB#<id>`.
