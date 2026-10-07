# VacTy — Aplicación web (MVP)

Panel web de VacTy para la enfermera del puesto: muestra en vivo la temperatura del termo porta-vacunas, hace sonar la alarma cuando sale de rango, guarda el historial y controla los lotes por vencimiento y VVM.

React 19 + TypeScript + Vite. Consume el backend desplegado en `https://vacfybackend.onrender.com`.

## Diseño

Diseño abierto, sin tarjetas: la jerarquía la dan la tipografía (Plus Jakarta Sans, empaquetada para funcionar sin internet), el espacio y el color del estado. Paleta: amarillo `#ffde59` y marrón `#390f07`; rojo, verde y azul solo para comunicar riesgo.

Las animaciones usan componentes de [React Bits](https://reactbits.dev), copiados en `src/components/reactbits/` (así se distribuyen) y adaptados (textos en español, paleta, accesibilidad y respeto de «reducir movimiento»):

| Componente | Dónde |
|---|---|
| Aurora | Fondo de la temperatura en vivo; su color cambia con el estado del termo |
| Counter | Dígitos de la temperatura que ruedan con cada lectura |
| CountUp | Cifras grandes (alertas, historial, lotes, termo) |
| BlurText | Títulos de pantalla y marca |
| PillNav | Navegación principal (con menú móvil) |
| BellToggle | Activar o silenciar el sonido de la alarma |
| Stepper | Verificación del frasco antes de vacunar (vencimiento → VVM → confirmar) |
| StatusMark | Resultado de la verificación (apto / no apto) |
| HoldButton | «Mantén para retirar del termo» en lugar de un cuadro de confirmación |
| AnimatedContent | Entrada escalonada de alertas, lotes y secciones |
| Grainient, RotatingText, ShinyText | Pantalla de acceso e indicador «Recibiendo en vivo» |

## Historias de usuario

| HU | Pantalla | Qué hace |
|---|---|---|
| HU14 Temperatura en vivo | **En vivo** | Temperatura y humedad recibidas por `/ws/device`, estado (en rango, riesgo de congelación, por encima del rango, sensor sin señal) y gráfico de los últimos 30 min |
| HU01 Alarma local | Banda roja en todas las pantallas | Con cada alerta `ACTIVE` de `/ws/alerts`: sonido repetido, vibración (en celulares), título de la pestaña y guía de qué hacer. Se apaga al marcarla como vista |
| HU02 Registro cada ~5 min | **Historial** | Lecturas del backend agrupadas cada 5 min: gráfico, tabla, mín./máx./promedio, % del tiempo en rango y % de registro completo |
| HU03 Sin internet y sincronización | Toda la app | Abre sin internet (PWA), muestra los últimos datos guardados, guarda las alertas marcadas como vistas sin conexión y las envía al volver; los WebSockets se reconectan solos |
| HU05 Vencimiento y VVM | **Lotes** | Registro del lote (vacuna, número, vencimiento, frascos, VVM guiado y foto opcional) y verificación antes de vacunar, que bloquea frascos vencidos o con VVM en descarte |
| HU12 Lotes por vencer | **Lotes** | Orden FEFO, «Usar primero» por vacuna, filtros (por vencer, vencidos, no aptos) y umbral configurable (7, 15, 30 o 60 días) |
| HU13 Alarmas por tipo de vacuna | **Mi termo** | El termo se registra con sus vacunas y su rango; solo admite vacunas con **el mismo rango** (si no, muestra el error). El rango se envía al backend como perfil del contenedor |

Las siglas usadas en cada pantalla se explican en una leyenda al pie (y al pasar el cursor sobre ellas).

## Correr en local

Requisitos: Node 20 o superior.

```bash
npm install
npm run dev        # http://localhost:8000
```

- El front **debe** correr en el puerto 8000: es el único origen local que acepta el CORS del backend.
- En desarrollo, Vite reenvía `/api` y `/ws` al backend (ver `vite.config.ts`). Así la cookie de sesión es del mismo sitio. Para usar otro backend: `BACKEND_URL=http://localhost:8080 npm run dev`.
- El backend gratuito de Render se duerme: la primera petición puede tardar hasta un minuto.

Otros comandos:

```bash
npm test           # pruebas de las reglas (rangos, lotes, FEFO, historial)
npm run build      # compila en dist/
npm run preview    # sirve dist/ en http://localhost:8000 con el mismo proxy
```

## Desplegar

1. Compilar con `npm run build` y publicar `dist/` (Vercel, Netlify o cualquier hosting estático).
2. **REST**: el hosting debe reenviar `/api/*` al backend para que la cookie `access-token` sea del mismo sitio (Safari y Firefox bloquean cookies de terceros). `vercel.json` ya lo hace en Vercel.
3. **WebSockets**: los hostings estáticos no los reenvían. Define `VITE_WS_URL=wss://vacfybackend.onrender.com` al compilar.
4. **En el backend**, agrega el dominio del front a `ALLOWED_ORIGINS` (hoy solo acepta `http://localhost:8000`). Sin esto, el backend responde 403 a las peticiones y a los WebSockets.

Variables (ver `.env.example`):

| Variable | Uso |
|---|---|
| `VITE_API_URL` | URL del backend para REST. Vacía = mismo origen (proxy/rewrite) |
| `VITE_WS_URL` | URL de los WebSockets (`wss://…`). Vacía = se deriva de la anterior o del origen |
| `BACKEND_URL` | Solo desarrollo: destino del proxy de Vite |

## Decisiones sobre el backend

- **Termo = dispositivo.** El backend admite un dispositivo por cuenta. En `deviceConnectionAddress` (texto libre que el backend no usa) se guarda `contenedor:<código>;perfil:<id>`, para recuperar el termo desde cualquier navegador.
- **Vacunas del termo = perfil de vacuna.** Al guardar el termo se crea (o reutiliza) un perfil llamado, por ejemplo, `Pentavalente + Neumococo conjugada (2 a 8 °C)` con el rango común, y se asigna al contenedor con `PUT /containers/{contenedor}/profile`. Así el motor de alertas del backend usa ese rango. `freezeSensitive` es verdadero si alguna vacuna se daña con la congelación (las alertas bajo el mínimo pasan a ser críticas).
- **Lotes, VVM y verificaciones se guardan en el dispositivo** (`localStorage`): el backend aún no tiene endpoints para ellos. Por eso no se comparten entre equipos. Cuando existan los endpoints, basta con reemplazar `src/lib/useLotes.ts`.
- **Historial.** El backend devuelve como máximo 1000 lecturas por consulta y, mientras hay una alerta abierta, guarda todas las lecturas. El front pide por tramos de 4 h y divide en dos los tramos que llegan llenos.
- **Errores.** El backend no envía el motivo del error, así que el mensaje depende del endpoint y el código (p. ej., 500 en el inicio de sesión = «DNI o contraseña incorrectos»).

## Estructura

```
src/
  api/         cliente HTTP y endpoints del backend
  context/     sesión, termo y tiempo real (WebSockets, alarma, cola sin conexión)
  lib/         reglas: validaciones, lotes/VVM/FEFO, historial, siglas, formatos
  components/  layout, banners de alarma y conexión, gráfico, selector VVM, leyenda
  pages/       Acceso, En vivo, Alertas, Historial, Lotes, Mi termo
```
