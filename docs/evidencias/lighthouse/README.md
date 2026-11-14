# Lighthouse en el despliegue (HU-FE-24, REND-1)

Criterio de aceptación de HU-FE-24: Lighthouse da **90 o más en rendimiento** para el inicio de sesión
y el catálogo de talleres. Medido sobre el despliegue real (`https://zeal-610558.trafficmanager.net`)
el 14 de noviembre de 2026, con Lighthouse 13.6.0 y Chrome 157.

| Página               | Perfil     | Rendimiento | FCP   | LCP   | TBT  | CLS   | Speed Index | JS descargado | Reporte                                              |
| -------------------- | ---------- | ----------- | ----- | ----- | ---- | ----- | ----------- | ------------- | ---------------------------------------------------- |
| `/login`             | Móvil      | **97**      | 1,9 s | 2,2 s | 0 ms | 0     | 2,2 s       | 195 kB        | [login-movil.html](login-movil.html)                 |
| `/login`             | Escritorio | **99**      | 0,5 s | 0,5 s | 0 ms | 0,001 | 1,4 s       | 195 kB        | [login-escritorio.html](login-escritorio.html)       |
| `/empleado/talleres` | Móvil      | **96**      | 1,9 s | 2,5 s | 0 ms | 0,001 | 1,9 s       | 227 kB        | [talleres-movil.html](talleres-movil.html)           |
| `/empleado/talleres` | Escritorio | **100**     | 0,5 s | 0,6 s | 0 ms | 0     | 0,5 s       | 231 kB        | [talleres-escritorio.html](talleres-escritorio.html) |

**Resultado: cumple** en las cuatro mediciones.

## Cómo se midió

- Solo la categoría de rendimiento. Móvil es el perfil por defecto de Lighthouse (red y CPU
  limitadas por simulación); escritorio, `--preset=desktop`.
- **Inicio de sesión:** página pública, en un Chrome sin perfil (caché vacía).
- **Catálogo de talleres:** necesita sesión, y el despliegue entra con Microsoft Entra ID. Una persona
  del equipo inició sesión con una cuenta de empleado, con "Recordarme", en un perfil temporal de
  Chrome. Lighthouse midió en ese perfil con `--disable-storage-reset` para conservar la cookie, y
  antes de cada medición se vació la caché del navegador, así que el JS se descargó completo. La
  página recupera la sesión con la cookie (`POST /api/auth/refresh` → 200) y carga el catálogo
  (`GET /api/talleres` → 200). Al terminar se cerró la sesión en el servidor y se borró el perfil.
- **Una medición a la vez:** si Lighthouse aborta la carga mientras la página renueva la sesión, el
  servidor rota la cookie pero el navegador no guarda la nueva. La siguiente carga presenta la cookie
  vieja y el backend la toma por un robo (SEG-4): revoca la sesión entera y alerta a los operadores.
  Pasó en un primer intento; las mediciones de esta tabla son de un segundo intento, ya sin ese
  problema.
- **Privacidad:** los reportes del catálogo no llevan capturas de pantalla, y el nombre de la cuenta
  se reemplazó por `[persona]`.

## Repetirlo

```bash
npx lighthouse@13.6.0 https://zeal-610558.trafficmanager.net/login --only-categories=performance --output=html --output-path=./login-movil.html
npx lighthouse@13.6.0 https://zeal-610558.trafficmanager.net/login --only-categories=performance --preset=desktop --output=html --output-path=./login-escritorio.html
```

Para el catálogo, abrir Chrome con `--remote-debugging-port=9223` y un perfil temporal, iniciar
sesión con "Recordarme", vaciar la caché y agregar `--port=9223 --disable-storage-reset` a la URL
`/empleado/talleres`.
