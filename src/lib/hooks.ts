import { useEffect, useRef, useState } from 'react';
import { pedirTicketWs } from '../api/servicios';

export function useEnLinea(): boolean {
  const [enLinea, setEnLinea] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setEnLinea(true);
    const off = () => setEnLinea(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return enLinea;
}

/** Hora actual que se refresca cada `cadaMs` (para textos como "hace 20 s"). */
export function useAhora(cadaMs = 1000): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), cadaMs);
    return () => window.clearInterval(id);
  }, [cadaMs]);
  return ahora;
}

export type EstadoConexion = 'conectando' | 'conectado' | 'desconectado';

/**
 * WebSocket con sesión que se reconecta solo (espera creciente hasta 30 s) y de inmediato
 * cuando vuelve internet. Con url = null no se conecta.
 *
 * Antes de cada conexión pide un ticket de un solo uso (POST /authentication/ws-ticket) y lo envía
 * en `?ticket=`: en producción la API pasa por el proxy del hosting y la cookie de sesión no viaja
 * en el WebSocket, que va directo al backend. Si la sesión venció, ese POST responde 401 y la app
 * vuelve al inicio de sesión.
 */
export function useWebSocket(
  url: string | null,
  alMensaje: (datos: unknown) => void,
  alConectar?: () => void,
): EstadoConexion {
  const [estado, setEstado] = useState<EstadoConexion>('conectando');
  const alMensajeRef = useRef(alMensaje);
  const alConectarRef = useRef(alConectar);
  alMensajeRef.current = alMensaje;
  alConectarRef.current = alConectar;

  useEffect(() => {
    if (!url) {
      setEstado('desconectado');
      return;
    }
    let ws: WebSocket | null = null;
    let pidiendoTicket = false;
    let espera = 1000;
    let temporizador: number | undefined;
    let cerrado = false;

    const reintentar = () => {
      setEstado('desconectado');
      temporizador = window.setTimeout(() => void conectar(), espera);
      espera = Math.min(espera * 2, 30_000);
    };

    const conectar = async () => {
      window.clearTimeout(temporizador);
      if (cerrado || ws || pidiendoTicket) return;
      setEstado('conectando');
      pidiendoTicket = true;
      let ticket: string;
      try {
        ticket = (await pedirTicketWs()).ticket;
      } catch {
        pidiendoTicket = false;
        if (!cerrado) reintentar();
        return;
      }
      pidiendoTicket = false;
      if (cerrado) return;

      const actual = new WebSocket(`${url}?ticket=${encodeURIComponent(ticket)}`);
      ws = actual;
      actual.onopen = () => {
        espera = 1000;
        setEstado('conectado');
        alConectarRef.current?.();
      };
      actual.onmessage = (e) => {
        try {
          alMensajeRef.current(JSON.parse(String(e.data)));
        } catch {
          // mensaje que no es JSON (p. ej. "nan" de firmware antiguo): se ignora
        }
      };
      actual.onclose = () => {
        if (ws === actual) ws = null;
        if (!cerrado) reintentar();
      };
      actual.onerror = () => actual.close();
    };

    const alVolverInternet = () => {
      if (!ws && !pidiendoTicket) {
        espera = 1000;
        void conectar();
      }
    };

    void conectar();
    window.addEventListener('online', alVolverInternet);
    return () => {
      cerrado = true;
      window.clearTimeout(temporizador);
      window.removeEventListener('online', alVolverInternet);
      ws?.close();
    };
  }, [url]);

  return estado;
}
