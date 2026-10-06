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

Las pruebas corren un proceso por archivo (aislamiento del tiempo real simulado) y usan como máximo
la mitad de los núcleos, para no saturar la máquina.

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

| Método y ruta                                                          | Respuesta                                |
| ---------------------------------------------------------------------- | ---------------------------------------- |
| `GET /api/wellbeing/reservas/agenda?desde=AAAA-MM-DD&hasta=AAAA-MM-DD` | `200` reservas del psicólogo, por inicio |

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
| `GET /api/wellbeing/reservas/mias`                     | `200` citas del empleado, por inicio                                                       |

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
El estado de cada cita lo decide el servidor (una confirmada que ya terminó llega `FINALIZADA`);
"Mis citas" las agrupa en Próximas, Historial y Canceladas (`?vista=`) y se vuelve a pedir con
cada `ACTUALIZADA`, así que una cita agendada en otra pestaña aparece al instante.

### Contrato de notificaciones (acordar con HU-BE-06)

Cualquier rol autenticado; cada persona solo ve y cambia las suyas.

| Método y ruta                         | Respuesta                                             |
| ------------------------------------- | ----------------------------------------------------- |
| `GET /api/notificaciones`             | `200` notificaciones propias, la más reciente primero |
| `POST /api/notificaciones/{id}/leida` | `204` · `404` no existe o es ajena (se da por leída)  |
| `POST /api/notificaciones/leidas`     | `204` marca todas las propias como leídas             |

```json
{
  "id": "notificacion-4",
  "type": "RESERVA_CONFIRMADA",
  "title": "Tu cita quedó confirmada",
  "message": "Laura Martínez · miércoles, 23 de septiembre de 10:00 a 10:50",
  "createdAt": "2026-09-23T14:20:00.000Z",
  "read": false,
  "link": "/empleado/mis-citas"
}
```

`link` es una ruta interna o `null`; el cliente rechaza cualquier otra cosa (p. ej. una URL
externa). Marcar como leída es optimista: si el servidor falla, el cambio se deshace y se avisa.

### Contrato de disponibilidad (acordar con HU-BE-07)

solo se puede cancelar una cita propia. El plazo mínimo para cancelar lo decide el
servidor (en el simulador: 24 horas antes del inicio); el frontend solo muestra el `message`

Todas las rutas exigen `Authorization: Bearer <token>` y rol `PSICOLOGO` (401 / 403). Las reglas de
negocio viven en el backend; el frontend muestra el `message` del error tal cual.

| Método y ruta                               | Respuesta                                                                           |
| ------------------------------------------- | ----------------------------------------------------------------------------------- |
| `POST /api/wellbeing/reservas/{id}/cancelar | `200` cita cancelada · `409` fuera del plazo permitido · `404` no existe o es ajena |

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
  "status": "CANCELADA"
}
```

```json
{
  "status": 409,
  "error": "Conflict",
  "message": "Ya no puedes cancelar esta cita: faltan menos de 24 horas para que empiece."
}
```

### Contrato de la sala de la sesión (acordar con HU-BE-12)

La sala es un sub-recurso de la reserva y la ven sus dos participantes (psicólogo y empleado); un rol
empresarial recibe `403` (HU-BE-11) y cualquier otra persona `404`. Solo el psicólogo la activa, y
solo dentro de la ventana de ingreso (en el simulador: desde 10 minutos antes hasta el fin).

| Método y ruta                                    | Respuesta                                                                   |
| ------------------------------------------------ | --------------------------------------------------------------------------- |
| `GET /api/wellbeing/reservas/{id}/sala`          | `200` sala · `403` rol empresarial · `404` no existe o no participa         |
| `POST /api/wellbeing/reservas/{id}/sala/activar` | `200` sala `ACTIVA` (idempotente) · `409` aún no abre, ya cerró o cancelada |

```json
{
  "reservationId": "reserva-16",
  "status": "PROGRAMADA",
  "startsAt": "2026-09-23T14:00:00.000Z",
  "endsAt": "2026-09-23T14:50:00.000Z",
  "opensAt": "2026-09-23T13:50:00.000Z",
  "closesAt": "2026-09-23T14:50:00.000Z",
  "participant": { "id": "usr-empleado-001", "fullName": "David Cajamarca" },
  "iceServers": [{ "urls": "turn:turn.zeal.co:3478", "username": "…", "credential": "…" }]
}
```

`status` ∈ `PROGRAMADA` (sin activar), `ACTIVA`, `CANCELADA`, `FINALIZADA`. `participant` es la otra
persona de la sesión. `iceServers` son los STUN/TURN para el video, con credenciales temporales que
entrega el servidor (el simulador envía `[]`: las dos pestañas están en el mismo equipo).

### Contrato de publicación de proyectos (acordar con HU-BE-14)

Rutas del rol `ADMIN`: las convocatorias publicadas por su organización y el alta de una nueva. En
cuanto se crea, aparece en el catálogo del empleado (`GET /api/proyectos`) y en la lista de las
demás sesiones del administrador por tiempo real.

| Método y ruta               | Respuesta                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------- |
| `GET /api/admin/proyectos`  | `200` proyectos de la organización, más recientes primero · `403` rol sin `ADMIN`     |
| `POST /api/admin/proyectos` | `201` proyecto creado · `400` datos inválidos · `409` título repetido con uno abierto |

```json
{
  "title": "Taller de innovación abierta",
  "area": "Innovación",
  "cohort": "Semilla 2026-3",
  "summary": "Explorar ideas nuevas con equipos de toda la empresa.",
  "description": ["Equipo para explorar ideas nuevas en la empresa.", "Se reúne cada semana."],
  "requirements": ["Experiencia previa en producto"],
  "skills": [],
  "capacity": 4,
  "closesAt": "2026-10-30T23:59:59.000Z"
}
```

El `GET` devuelve cada proyecto como el catálogo de HU-BE-16 más `publishedAt`. El servidor valida
lo mismo que el formulario: título de 5 a 80 caracteres, área y cohorte de 2 a 40, resumen de 10 a
140, descripción de 20 a 1500, hasta 8 requisitos y 8 habilidades de hasta 100 caracteres cada uno,
capacidad entera de 1 a 100 y `closesAt` posterior al instante actual (el formulario envía el día
elegido a las 23:59:59 hora local). El servidor asigna `id`, `publishedAt`, `occupied: 0` y
`version: 1`; el 409 responde `Ya tienes un proyecto abierto con ese título`.

### Contrato de convocatorias internas (acordar con HU-BE-16)

Rutas del rol `EMPLEADO`. Qué convocatorias están abiertas y cuántos cupos quedan lo decide el
servidor; el catálogo solo lista las abiertas, ordenadas por fecha de cierre.

| Método y ruta             | Respuesta                                                          |
| ------------------------- | ------------------------------------------------------------------ |
| `GET /api/proyectos`      | `200` convocatorias abiertas (sin descripción ni requisitos)       |
| `GET /api/proyectos/{id}` | `200` detalle con `description`, `requirements` y `skills` · `404` |

```json
{
  "id": "proyecto-guardia-datos",
  "title": "Data Platform · Turno de guardia",
  "area": "Datos",
  "cohort": "Rotación trimestral",
  "summary": "Acompañar el oncall con un mentor durante 6 semanas.",
  "capacity": 4,
  "occupied": 2,
  "version": 7,
  "closesAt": "2026-09-28T14:20:00.000Z"
}
```

`version` crece con cada cambio de cupos: el cliente se queda siempre con la más nueva entre lo que
cargó y lo que llegó en vivo. Al llegar a cero, "Postularme" pasa a "Cupos agotados".

### Contrato de postulaciones (acordar con HU-BE-17)

Rutas del rol `EMPLEADO`. Revisar el cupo y asignarlo es una sola operación atómica en el servidor:
dos personas nunca reciben el mismo cupo; quien llega cuando ya no queda entra a la lista de espera
con su puesto. Postularse dos veces a la misma convocatoria devuelve la misma postulación.

| Método y ruta                            | Respuesta                                                                              |
| ---------------------------------------- | -------------------------------------------------------------------------------------- |
| `POST /api/proyectos/{id}/postulaciones` | `201` postulación nueva · `200` la que ya existía · `409` convocatoria cerrada · `404` |
| `GET /api/postulaciones/mias`            | `200` postulaciones de la persona, las más recientes primero                           |

```json
{
  "id": "postulacion-12",
  "projectId": "proyecto-guardia-datos",
  "projectTitle": "Data Platform · Turno de guardia",
  "status": "EN_ESPERA",
  "waitlistPosition": 2,
  "createdAt": "2026-09-23T14:20:00.000Z",
  "version": 1
}
```

`status` ∈ `ACEPTADA` (`waitlistPosition: null`), `EN_ESPERA`. Al aceptar, el servidor sube la
`version` de los cupos y la avisa por el canal de la convocatoria.

## Tiempo real (RT-2)

- **Conexión:** STOMP sobre SockJS contra el Real-Time Gateway (`VITE_REALTIME_URL`, por defecto
  `http://localhost:8083/ws`), con `Authorization: Bearer <token>` en el frame `CONNECT`,
  reconexión automática cada 5 s y heartbeats de 10 s. La barra superior muestra el estado.
- **Destino `/topic/franjas`:** `{ "type": "CREADA" | "ELIMINADA" | "ACTUALIZADA", "slot": <franja> }`.
- **Cola privada `/user/queue/notificaciones`** (destino de usuario de STOMP: el gateway solo
  entrega a la persona autenticada en el `CONNECT`): `{ "type": "NUEVA", "notification": <notificación> }`
  cuando llega una (se muestra un aviso emergente una sola vez y suma a la campana) o
  `{ "type": "LEIDAS", "ids": [...] }` cuando se marcan como leídas en otra pestaña o equipo. Lo
  que llega mientras carga la lista no se pierde, y al reconectar se vuelve a pedir.
- **Cola privada `/user/queue/salas`:** `{ "type": "SALA_ACTUALIZADA", "reservationId": … }` cuando
  la sala cambia (se activó o se canceló la sesión; el cliente la vuelve a pedir) y
  `{ "type": "SENAL", "reservationId": …, "signal": <señal> }` con las señales de la otra persona.
- **Señalización WebRTC (HU-FE-12):** cada participante envía (STOMP `SEND`) a
  `/app/salas/{id}/senales` y el servidor reenvía a la otra persona, solo si ambos son participantes
  y la sala está activa. Señales: `LISTO` (entré o me reconecté, con el estado de micrófono y
  cámara), `OFERTA` y `RESPUESTA` (`id` de la negociación y `sdp`), `CANDIDATO` (`id` y candidato
  ICE), `MEDIOS` (cambié micrófono o cámara) y `SALIO`. Solo el psicólogo ofrece, así nunca se cruzan
  dos negociaciones; lo de una negociación anterior se descarta por su `id`. Si la conexión falla o
  se recupera el tiempo real, se vuelve a negociar.
- **Canal de cada convocatoria `/topic/proyectos/{id}/cupos` (HU-FE-16):**
  `{ "type": "CUPOS", "projectId": …, "capacity": …, "occupied": …, "version": … }` cuando el
  servidor asigna, libera o amplía cupos. Un aviso con versión menor o igual a la conocida se
  descarta; al reconectar se vuelve a pedir el catálogo.
- **Cola privada `/user/queue/proyectos` (HU-FE-14):**
  `{ "type": "PUBLICADO", "project": <proyecto> }` cuando esta sesión u otra de la empresa publica
  una convocatoria. El cliente se queda con la versión más nueva de cada `id` (lo que publicó él
  mismo no se anuncia dos veces) y la lista no se recarga; los cupos no viajan por aquí, tienen su
  canal `/topic/proyectos/{id}/cupos`. Al reconectar se vuelve a pedir la lista.
- **Cola privada `/user/queue/postulaciones` (HU-FE-17):**
  `{ "type": "POSTULACION", "application": <postulación> }` cuando se crea o cambia una postulación
  de la persona (otra pestaña, otro equipo o el paso de la lista de espera a aceptada). Se queda la
  versión más nueva; al reconectar se vuelve a pedir la lista.
- **Concurrencia en el cliente:** los eventos que llegan mientras carga una semana se reaplican sobre
  la respuesta del servidor; una franja eliminada no reaparece por un evento atrasado; al
  recuperarse la conexión se vuelve a pedir la semana para no perder cambios.
- **Con el simulador:** el tiempo real se simula entre pestañas del mismo navegador. Para verlo,
  inicia sesión como psicóloga con "Recordarme", abre `/psicologo/disponibilidad` en dos pestañas y
  abre o elimina una franja en una de ellas. Para la videollamada, inicia sesión (sin "Recordarme")
  como psicóloga en una pestaña y como empleado en otra durante una sesión en curso: la psicóloga
  activa la sala desde su agenda y el empleado, que espera desde "Ir a la sala" en Mis citas, entra
  en cuanto se activa.

## Sesión y seguridad

- **Rutas por rol:** cada rol vive bajo su prefijo (`/empleado`, `/psicologo`, `/admin`). Sin
  sesión, una ruta protegida manda al login; con la sesión de otro rol muestra "Permiso denegado"
  (aislamiento entre roles), también ante direcciones que no existen bajo ese prefijo (p. ej. un
  enlace al chat de un empleado abierto por el administrador). La autorización real la aplica
  siempre el backend.
- **403 del servidor (HU-FE-11):** si lo que carga una pantalla responde 403, la pantalla se
  reemplaza por "Permiso denegado", sin nada de su contenido y sin ofrecer reintento. Aplica a toda
  carga hecha con `useFetch` o `useLiveFetch` (y a la semana de franjas): una pantalla nueva, como
  el chat, lo hereda al usar esos hooks.
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
