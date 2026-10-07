// URL del backend para REST. Vacía = mismo origen (proxy de Vite en desarrollo, rewrite del hosting en producción).
const api = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');
// URL para los WebSockets. Si no se indica, se deriva de la de REST o del origen actual.
const ws = (import.meta.env.VITE_WS_URL ?? '').trim().replace(/\/+$/, '');

export const API_URL = api;

export const WS_URL =
  ws ||
  (api
    ? api.replace(/^http/, 'ws')
    : typeof window === 'undefined'
      ? ''
      : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`);

/** Días antes del vencimiento en que un lote se considera "por vencer" (valor inicial del filtro). */
export const DIAS_POR_VENCER = 30;

/** Sin lecturas durante este tiempo, el panel muestra el sensor como "sin señal" (igual que el backend). */
export const MS_SENSOR_SIN_SENAL = 2 * 60 * 1000;
