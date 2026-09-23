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

| Variable            | Valor en desarrollo | Uso                                                     |
| ------------------- | ------------------- | ------------------------------------------------------- |
| `VITE_API_MOCKING`  | `enabled`           | `disabled` para consumir el backend real                |
| `VITE_API_BASE_URL` | _(vacío)_           | URL del API Gateway; vacío = mismo origen del frontend. |

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

## Identidad visual

Los colores, tipografías (Anton, Archivo, IBM Plex Mono) y radios vienen del **Manual de Identidad
ZEAL v1.0** y del Figma _ZEAL — Flujo de Pantallas (Desktop + Responsive)_. Regla de marca: los
colores de estado (salvia, malva, coral) expresan semántica, nunca navegación principal.

## Convención de ramas

- `main`: código estable para entregas.
- `develop`: integración diaria.
- `feature/<historia>`: una rama por historia de usuario (ej. `feature/HU-FE-01-login-navegacion-por-rol`).

Los commits referencian el work item de Azure Boards con `AB#<id>`.
