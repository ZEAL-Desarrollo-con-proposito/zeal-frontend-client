# SEG-2 en producción: inicio de sesión con Microsoft (HU-FE-21)

Prueba manual de SEG-2 (autenticación) sobre el despliegue real
(`https://zeal-610558.trafficmanager.net`), con el login real de Microsoft Entra ID (tenant de la
Escuela), el 17 de noviembre de 2026 entre las 02:00 y las 02:15 UTC. Complementa las pruebas
automatizadas de `zeal-infra-compose/docs/evidencias/SEG.md`, que usan el proveedor de login de
pruebas y no se pueden repetir contra Microsoft.

| Caso                                  | Qué se hizo                                                             | Resultado                                                                                                                                                 | Estado              |
| ------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| 1. Cuenta registrada entra            | Cerrar sesión y entrar de cero con "Iniciar sesión con Microsoft"       | Vuelve a su agenda (`/psicologo/agenda`). Callback en **0,35 s** en el servidor (meta ≤ 1 s); 1,18 s desde que Microsoft devuelve hasta la agenda cargada | ✅ Cumple           |
| 2. Cancelar en Microsoft              | "Cancelar" en la pantalla de permisos de Microsoft                      | No se crea sesión; vuelve al login con un mensaje genérico (`/login?error=fallo`)                                                                         | ⚠️ Mensaje genérico |
| 3. Cuenta de la Escuela no registrada | Entrar con la cuenta de una persona de otra carrera que no está en ZEAL | No se crea sesión; `/login?error=cuenta_no_registrada` con "Esa cuenta de Microsoft no tiene acceso a ZEAL…", sin decir qué cuentas existen               | ✅ Cumple           |

Después de los casos 1 y 3 se revisó que ningún token quedara en `localStorage` ni en
`sessionStorage`: el access token vive solo en memoria y la renovación usa la cookie `HttpOnly` del
backend.

## Capturas

| Caso                    | Captura                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| Página de inicio        | [01-login.jpg](01-login.jpg)                                                                |
| 1. Cuenta registrada    | [02-cuenta-registrada-entra.jpg](02-cuenta-registrada-entra.jpg)                            |
| 2. Permisos y cancelar  | [03-microsoft-permisos.jpg](03-microsoft-permisos.jpg) → [04-cancelar.jpg](04-cancelar.jpg) |
| 3. Cuenta no registrada | [05-cuenta-no-registrada.jpg](05-cuenta-no-registrada.jpg)                                  |

## Auditoría y métricas en producción

Cada intento quedó en la auditoría de seguridad del backend (Loki, `logger_name=zeal.security.audit`),
con hora, IP y `correlationId`, y **sin el correo** de la cuenta:

```text
02:05:18Z event=LOGIN_MICROSOFT outcome=EXITO    userId=usr-psicologo-… correlationId=c64441581baa…  (caso 1)
02:07:18Z event=LOGIN_MICROSOFT outcome=DENEGADO userId=null           correlationId=4628711460bb…  detail="proveedor:consent_required"  (caso 2)
02:14:10Z event=LOGIN_MICROSOFT outcome=DENEGADO userId=null           correlationId=d9f565c8cc9a…  detail="cuenta_no_registrada"        (caso 3)
```

En Prometheus, `http_server_requests_seconds_max{uri="/api/auth/microsoft/callback"}` marcó como máximo
0,35 s, y `zeal_business_logins_total` sumó el inicio de sesión del caso 1 (alimenta el panel de
sesiones iniciadas del tablero de Negocio).

## Hallazgo del caso 2

Al cancelar en la pantalla de permisos, Microsoft Entra ID no devuelve `error=access_denied` (lo que
asume el contrato `auth-microsoft.md`), sino `error=consent_required` con `AADSTS65004` ("User declined
to consent"). El callback solo traduce `access_denied` a `/login?error=cancelado`, así que este caso
termina en `error=fallo` y la persona ve "No pudimos iniciar sesión con Microsoft" en lugar de
"Cancelaste el inicio de sesión". La seguridad no cambia (no hay sesión y el mensaje no revela nada);
el ajuste es del backend: tratar también `consent_required` como cancelado.

## Cómo se hizo

- Microsoft ya tenía una sesión abierta en el navegador, así que no muestra pantallas por defecto. Para
  los casos 2 y 3 se pidió el inicio de sesión igual que el front (`POST /api/auth/microsoft`) y se
  agregó a la dirección de Microsoft el parámetro estándar de OpenID Connect `prompt=consent` (muestra
  la pantalla de permisos con "Cancelar") o `prompt=select_account` (permite elegir otra cuenta).
- Las contraseñas las escribió cada persona en la página de Microsoft; ZEAL nunca las ve.
- **Privacidad:** el nombre y el correo de las capturas se reemplazaron por `[persona]` y `[correo]`, y
  aquí no se incluyen la IP ni los identificadores completos.
