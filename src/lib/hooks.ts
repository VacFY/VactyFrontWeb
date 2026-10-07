import { useEffect, useRef, useState } from 'react';

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
 * WebSocket que se reconecta solo (espera creciente hasta 30 s) y de inmediato
 * cuando vuelve internet. Con url = null no se conecta.
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
    let espera = 1000;
    let temporizador: number | undefined;
    let cerrado = false;

    const conectar = () => {
      window.clearTimeout(temporizador);
      if (cerrado) return;
      setEstado('conectando');
      ws = new WebSocket(url);
      ws.onopen = () => {
        espera = 1000;
        setEstado('conectado');
        alConectarRef.current?.();
      };
      ws.onmessage = (e) => {
        try {
          alMensajeRef.current(JSON.parse(String(e.data)));
        } catch {
          // mensaje que no es JSON (p. ej. "nan" de firmware antiguo): se ignora
        }
      };
      ws.onclose = () => {
        ws = null;
        if (cerrado) return;
        setEstado('desconectado');
        temporizador = window.setTimeout(conectar, espera);
        espera = Math.min(espera * 2, 30_000);
      };
      ws.onerror = () => ws?.close();
    };

    const alVolverInternet = () => {
      if (!ws) {
        espera = 1000;
        conectar();
      }
    };

    conectar();
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
