# VacTy — Aplicación web (MVP)

Panel web de VacTy. La **enfermera** vincula el termo que lleva con su código y su clave, ve su temperatura en vivo, recibe la alarma cuando sale de rango y controla sus lotes. El **supervisor** de la microred ve todos los termos, los registra, entrega sus claves y sabe quién tiene cada uno.

React 19 + TypeScript + Vite. Consume el backend VacfyBackend (en local, `http://localhost:8080`; desplegado, `https://vacfybackend.onrender.com`).

## Diseño

Diseño abierto, sin tarjetas: la jerarquía la dan la tipografía (Plus Jakarta Sans, empaquetada para funcionar sin internet), el espacio y el color del estado. Paleta: amarillo `#ffde59` y marrón `#390f07`; rojo, verde y azul solo para comunicar riesgo.

Las animaciones usan componentes de [React Bits](https://reactbits.dev), copiados en `src/components/reactbits/` (así se distribuyen) y adaptados (textos en español, paleta, accesibilidad y respeto de «reducir movimiento»):

| Componente | Dónde |
|---|---|
| Aurora | Fondo de la temperatura en vivo; su color cambia con el estado del termo |
| Counter | Dígitos de la temperatura que ruedan con cada lectura |
| CountUp | Cifras grandes (alertas, historial, lotes) |
| BlurText | Títulos de pantalla y marca |
| PillNav | Navegación principal (con menú móvil) |
| BellToggle | Activar o silenciar el sonido de la alarma |
| Stepper | Verificación del frasco antes de vacunar (vencimiento → VVM → confirmar) |
| StatusMark | Resultado de la verificación (apto / no apto) |
| HoldButton | «Mantén para…» (entregar el termo, descartar un lote, generar otra clave) en lugar de un cuadro de confirmación |
| AnimatedContent | Entrada escalonada de alertas, lotes, termos y secciones |
| Grainient, RotatingText, ShinyText | Pantalla de acceso e indicador «Recibiendo en vivo» |

## Roles

`GET /api/v1/profile` devuelve el `role` y el front muestra las pantallas según él:

| Rol | Pantallas |
|---|---|
| Enfermera | **En vivo**, **Alertas**, **Historial**, **Lotes** y **Mis termos** (vincular y entregar) de los termos que tiene vinculados |
| Supervisor | **Termos** (inicio: todos los termos, registrar, clave, desvincular, quién lo tuvo) y las mismas pantallas para cualquier termo |

Para hacer supervisor una cuenta, en Supabase (*SQL Editor*): `UPDATE credentials SET role = 'SUPERVISOR' WHERE user_dni = '<DNI>';`

## Historias de usuario

| HU | Pantalla | Qué hace |
|---|---|---|
| Vinculación termo → enfermera | **Mis termos** / **Termos** | El supervisor registra el termo con el código de su sensor y recibe una clave `XXX-XXX` (se muestra una sola vez, para imprimir la etiqueta). La enfermera lo vincula con código + clave (o pegando el texto del QR `vacty:<codigo>:<clave>`). Si otra enfermera lo vincula, pasa a ella (cambio de turno) y la primera recibe el aviso |
| HU14 Temperatura en vivo | **En vivo** | Temperatura y humedad recibidas por `/ws/device`, estado (en rango, riesgo de congelación, por encima del rango, sensor sin señal), rango calculado por el backend y gráfico de los últimos 30 min |
| HU01 Alarma local | Banda roja en todas las pantallas | Con cada alerta `ACTIVE` de cualquiera de mis termos: título y mensaje del backend y guía de qué hacer. Sonido repetido, vibración y título de la pestaña solo para las de temperatura y sensor (las de vencimiento no suenan). Se apaga al marcarla como vista |
| HU02 Registro cada ~5 min | **Historial** | Lecturas del backend agrupadas cada 5 min: gráfico, tabla, mín./máx./promedio, % del tiempo en rango y % de registro completo. La enfermera ve desde que vinculó el termo |
| HU03 Sin internet y sincronización | Toda la app | Abre sin internet (PWA), muestra los últimos datos guardados, guarda las alertas marcadas como vistas sin conexión y las envía al volver; los WebSockets se reconectan solos |
| HU05 Vencimiento y VVM | **Lotes** | Lectura del código GS1 (escáner o `(01)…(17)…(10)…`), registro del lote en el backend, VVM guiado y foto opcional, verificación antes de vacunar, «se terminó» y «descartar» |
| HU12 Lotes por vencer | **Lotes** | Orden FEFO, «Usar primero» por vacuna, filtros (por vencer, vencidos, no aptos), umbral configurable (7, 15, 30 o 60 días) y, con varios termos, los que vencen en todos |
| HU13 Alarmas por tipo de vacuna | **En vivo** / **Termos** | El backend calcula el rango del termo con sus lotes activos (o con el perfil estándar 2–8 °C si no tiene) y rechaza un lote sin rango común con los demás (el mensaje se muestra tal cual) |

Las siglas usadas en cada pantalla se explican en una leyenda al pie (y al pasar el cursor sobre ellas).

## Correr en local

Requisitos: Node 20.19 o superior y el backend corriendo. No se usa Docker.

```bash
# 1. Backend (en ../VacfyBackend): su .env ya apunta a Supabase y al broker MQTT en la nube
./mvnw spring-boot:run

# 2. Front
npm install
npm run dev        # http://localhost:8000
```

- El front **debe** correr en el puerto 8000: es el único origen local que acepta el CORS del backend (`ALLOWED_ORIGINS`).
- En desarrollo, Vite reenvía `/api` y `/ws` a `http://localhost:8080` (ver `vite.config.ts`). Para usar el backend desplegado: `BACKEND_URL=https://vacfybackend.onrender.com npm run dev` (el de Render se duerme: la primera petición puede tardar hasta un minuto).
- Si el inicio de sesión funciona pero la siguiente petición responde 401 (Safari no guarda cookies `Secure` en http), arranca el backend con `COOKIE_SECURE=false`.

Otros comandos:

```bash
npm test           # pruebas de las reglas (QR, roles, alertas, lotes, FEFO, historial)
npm run build      # compila en dist/
npm run preview    # sirve dist/ en http://localhost:8000 con el mismo proxy
```

## Desplegar

1. Compilar con `npm run build` y publicar `dist/`. En **Netlify** basta con conectar el repositorio: `netlify.toml` ya define el build, la versión de Node, `VITE_WS_URL` y el proxy de `/api`. En Vercel lo hace `vercel.json`.
2. **REST**: el hosting reenvía `/api/*` al backend para que la cookie `access-token` sea del mismo sitio (Safari y Firefox bloquean cookies de terceros).
3. **WebSockets**: los hostings estáticos no los reenvían, así que van directo a `VITE_WS_URL=wss://vacfybackend.onrender.com`. Como ahí no viaja la cookie, antes de cada conexión el front pide un ticket de un solo uso (`POST /api/v1/authentication/ws-ticket`, por el proxy y con la cookie) y abre `wss://…/ws/alerts?ticket=…`.
4. **En el backend**, agrega el dominio del front a `ALLOWED_ORIGINS` (admite comodines, p. ej. `https://*.netlify.app`). Sin esto, el backend responde 403 a las peticiones y a los WebSockets.

Variables (ver `.env.example`):

| Variable | Uso |
|---|---|
| `VITE_API_URL` | URL del backend para REST. Vacía = mismo origen (proxy/rewrite) |
| `VITE_WS_URL` | URL de los WebSockets (`wss://…`). Vacía = se deriva de la anterior o del origen |
| `BACKEND_URL` | Solo desarrollo: destino del proxy de Vite (por defecto `http://localhost:8080`) |

## Decisiones sobre el backend

- **Termos vinculados.** La lista de termos sale de `GET /my/containers` (enfermera) o `GET /containers` (supervisor) y se refresca cada 60 s y con cada mensaje de `/ws/alerts`. El termo que se muestra en En vivo, Historial y Lotes se elige en la cabecera y se recuerda por usuario.
- **Errores.** Termos, lotes, vacunas y todos los 403 y 429 traen el motivo en `message`, y el front lo muestra tal cual. Autenticación y perfil siguen sin motivo: ahí el mensaje depende del endpoint y el código (p. ej., 500 en el inicio de sesión = «DNI o contraseña incorrectos»).
- **VVM, foto y verificaciones se guardan en el dispositivo** (`localStorage`, por id de lote): el backend no tiene campos para ellos, así que no se comparten entre equipos. Los lotes en sí (vacuna, número, vencimiento, frascos) están en el backend.
- **Historial.** El backend devuelve como máximo 1000 lecturas por consulta y, mientras hay una alerta abierta, guarda todas las lecturas. El front pide por tramos de 4 h y divide en dos los tramos que llegan llenos.
- **Catálogo de vacunas.** Sale de `GET /vaccines` con sus cuidados (`careProfileLabel`, `careInstructions`). Para marcarlas como verificadas o editarlas, por ahora se usa Swagger (`PUT /api/v1/vaccines/{id}`).

## Estructura

```
src/
  api/         cliente HTTP y endpoints del backend
  context/     sesión y rol, termos (lista, termo activo, vincular/entregar) y tiempo real (WebSockets, alarma, cola sin conexión)
  lib/         reglas: validaciones, termos y QR, alertas, lotes/VVM/FEFO, historial, siglas, formatos
  components/  layout, banners de alarma y conexión, gráfico, selector VVM, leyenda
  pages/       Acceso, En vivo, Alertas, Historial, Lotes, Termos, Cuenta
```
