import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, esErrorDeConexion } from '../api/http';
import { listarAlertas, listarLecturas, marcarAlertaVista } from '../api/servicios';
import type { Alerta, LecturaEnVivo } from '../api/tipos';
import { WS_URL } from '../config';
import { ordenarAlertas } from '../lib/alertas';
import { esNumero } from '../lib/format';
import { useWebSocket, type EstadoConexion } from '../lib/hooks';
import { prepararAudio, sonarPitido } from '../lib/sonido';
import { claveUsuario, guardar, guardarCache, leer, leerCache } from '../lib/storage';
import { useDni } from './SesionContext';
import { useTermo } from './TermoContext';

export interface PuntoVivo {
  t: number;
  temperatura: number | null;
  humedad: number | null;
}

interface TiempoRealCtx {
  estadoSensor: EstadoConexion;
  estadoAlertas: EstadoConexion;
  ultima: PuntoVivo | null;
  /** Lecturas de los últimos 30 min para el gráfico en vivo. */
  serie: PuntoVivo[];
  /** Alertas del termo recibidas en vivo (abiertas y las que se cerraron en esta sesión). */
  alertasEnVivo: Alerta[];
  alertasAbiertas: Alerta[];
  /** Alerta activa (sin ver) más importante: dispara la alarma. */
  alarma: Alerta | null;
  marcarVista(id: number): Promise<'enviada' | 'pendiente'>;
  pendientes: number;
  sonido: boolean;
  cambiarSonido(activo: boolean): void;
}

const Contexto = createContext<TiempoRealCtx | null>(null);
export const VENTANA_EN_VIVO_MS = 30 * 60 * 1000;
const MAX_PUNTOS = 1500;

function recortar(serie: PuntoVivo[]): PuntoVivo[] {
  const limite = Date.now() - VENTANA_EN_VIVO_MS;
  const r = serie.filter((p) => p.t >= limite);
  return r.length > MAX_PUNTOS ? r.slice(r.length - MAX_PUNTOS) : r;
}

export function TiempoRealProvider({ children }: { children: ReactNode }) {
  const dni = useDni();
  const { termo } = useTermo();
  const contenedor = termo?.contenedor ?? null;

  const claveSerie = claveUsuario(dni, `serie:${contenedor}`);
  const claveAlertas = claveUsuario(dni, `alertas-abiertas:${contenedor}`);
  const clavePendientes = claveUsuario(dni, 'pendientes-vista');

  const [serie, setSerie] = useState<PuntoVivo[]>([]);
  const [alertas, setAlertas] = useState<Map<number, Alerta>>(new Map());
  const [pendientes, setPendientes] = useState<number[]>(() => leer<number[]>(clavePendientes, []));
  const [sonido, setSonido] = useState(() => leer<boolean>('sonido', true));
  const pendientesRef = useRef(pendientes);
  pendientesRef.current = pendientes;

  // ── Al cambiar de termo: datos guardados + últimos 30 min del servidor ──
  useEffect(() => {
    if (!contenedor) {
      setSerie([]);
      setAlertas(new Map());
      return;
    }
    setSerie(recortar(leer<PuntoVivo[]>(claveSerie, [])));
    const cacheAlertas = leerCache<Alerta[]>(claveAlertas)?.datos ?? [];
    setAlertas(new Map(cacheAlertas.map((a) => [a.id, a])));

    const control = new AbortController();
    const hasta = new Date();
    listarLecturas(contenedor, new Date(hasta.getTime() - VENTANA_EN_VIVO_MS), hasta, control.signal)
      .then((lecturas) => {
        const historicas = lecturas.map((l) => ({
          t: new Date(l.receivedAt).getTime(),
          temperatura: l.temperatura,
          humedad: l.humedad,
        }));
        setSerie((actual) => {
          const porT = new Map<number, PuntoVivo>();
          for (const p of [...historicas, ...actual]) porT.set(p.t, p);
          return recortar([...porT.values()].sort((a, b) => a.t - b.t));
        });
      })
      .catch(() => {
        // sin conexión: se queda con lo guardado en el dispositivo
      });
    return () => control.abort();
  }, [contenedor, claveSerie, claveAlertas]);

  // Guarda la serie cada 10 s para poder mostrarla sin internet.
  const serieRef = useRef(serie);
  serieRef.current = serie;
  useEffect(() => {
    if (!contenedor) return;
    const id = window.setInterval(() => guardar(claveSerie, serieRef.current), 10_000);
    return () => window.clearInterval(id);
  }, [contenedor, claveSerie]);

  // ── /ws/device: temperatura en vivo ──
  const alLeer = useCallback(
    (datos: unknown) => {
      const l = datos as LecturaEnVivo;
      if (!contenedor || !l || l.contenedor !== contenedor) return;
      const punto: PuntoVivo = {
        t: Date.now(),
        temperatura: esNumero(l.temperatura) ? l.temperatura : null,
        humedad: esNumero(l.humedad) ? l.humedad : null,
      };
      setSerie((s) => recortar([...s, punto]));
    },
    [contenedor],
  );
  const estadoSensor = useWebSocket(contenedor ? `${WS_URL}/ws/device` : null, alLeer);

  // ── /ws/alerts: alertas en vivo ──
  const conPendientes = useCallback(
    (a: Alerta): Alerta =>
      a.status === 'ACTIVE' && pendientesRef.current.includes(a.id)
        ? { ...a, status: 'ACKNOWLEDGED', acknowledgedAt: new Date().toISOString() }
        : a,
    [],
  );

  const alRecibirAlerta = useCallback(
    (datos: unknown) => {
      const a = datos as Alerta;
      if (!contenedor || !a || typeof a.id !== 'number' || a.contenedor !== contenedor) return;
      setAlertas((m) => new Map(m).set(a.id, conPendientes(a)));
    },
    [contenedor, conPendientes],
  );

  const actualizarPendientes = useCallback(
    (fn: (p: number[]) => number[]) => {
      setPendientes((p) => {
        const nuevo = fn(p);
        guardar(clavePendientes, nuevo);
        return nuevo;
      });
    },
    [clavePendientes],
  );

  // Envía las "marcar como vista" que se hicieron sin internet.
  const enviando = useRef(false);
  const enviarPendientes = useCallback(async () => {
    if (enviando.current || !pendientesRef.current.length) return;
    enviando.current = true;
    try {
      for (const id of [...pendientesRef.current]) {
        try {
          const a = await marcarAlertaVista(id);
          setAlertas((m) => (m.has(id) ? new Map(m).set(id, a) : m));
          actualizarPendientes((p) => p.filter((x) => x !== id));
        } catch (e) {
          if (esErrorDeConexion(e)) break;
          if (e instanceof ApiError && e.status === 404) actualizarPendientes((p) => p.filter((x) => x !== id));
          else break;
        }
      }
    } finally {
      enviando.current = false;
    }
  }, [actualizarPendientes]);

  // Foto de las alertas abiertas por REST. Así la alarma suena aunque el WebSocket de alertas
  // no esté disponible, y se descartan las que se cerraron mientras no había conexión.
  const sincronizarAbiertas = useCallback(async () => {
    if (!contenedor) return;
    try {
      const abiertas = await listarAlertas('OPEN', contenedor);
      setAlertas((m) => {
        const nuevo = new Map<number, Alerta>();
        for (const a of m.values()) if (a.status === 'RESOLVED') nuevo.set(a.id, a);
        for (const a of abiertas) nuevo.set(a.id, conPendientes(a));
        return nuevo;
      });
    } catch {
      // sin conexión: se mantiene lo guardado en el dispositivo
    }
  }, [contenedor, conPendientes]);

  const alConectarAlertas = useCallback(() => {
    void enviarPendientes().then(sincronizarAbiertas);
  }, [enviarPendientes, sincronizarAbiertas]);

  const estadoAlertas = useWebSocket(contenedor ? `${WS_URL}/ws/alerts` : null, alRecibirAlerta, alConectarAlertas);

  useEffect(() => {
    void sincronizarAbiertas();
    const alVolver = () => void enviarPendientes().then(sincronizarAbiertas);
    window.addEventListener('online', alVolver);
    const id = window.setInterval(alVolver, 60_000);
    return () => {
      window.removeEventListener('online', alVolver);
      window.clearInterval(id);
    };
  }, [enviarPendientes, sincronizarAbiertas]);

  const alertasEnVivo = useMemo(() => ordenarAlertas([...alertas.values()]), [alertas]);
  const alertasAbiertas = useMemo(() => alertasEnVivo.filter((a) => a.status !== 'RESOLVED'), [alertasEnVivo]);

  useEffect(() => {
    if (contenedor) guardarCache(claveAlertas, alertasAbiertas);
  }, [contenedor, claveAlertas, alertasAbiertas]);

  const marcarVista = useCallback(
    async (id: number): Promise<'enviada' | 'pendiente'> => {
      try {
        const a = await marcarAlertaVista(id);
        setAlertas((m) => new Map(m).set(id, a));
        return 'enviada';
      } catch (e) {
        if (!esErrorDeConexion(e)) throw e;
        actualizarPendientes((p) => (p.includes(id) ? p : [...p, id]));
        setAlertas((m) => {
          const a = m.get(id);
          return a ? new Map(m).set(id, { ...a, status: 'ACKNOWLEDGED', acknowledgedAt: new Date().toISOString() }) : m;
        });
        return 'pendiente';
      }
    },
    [actualizarPendientes],
  );

  // ── Alarma local: sonido, vibración y título de la pestaña ──
  const alarma = alertasAbiertas.find((a) => a.status === 'ACTIVE') ?? null;

  useEffect(() => {
    const desbloquear = () => prepararAudio();
    document.addEventListener('pointerdown', desbloquear);
    document.addEventListener('keydown', desbloquear);
    return () => {
      document.removeEventListener('pointerdown', desbloquear);
      document.removeEventListener('keydown', desbloquear);
    };
  }, []);

  useEffect(() => {
    if (!alarma) return;
    navigator.vibrate?.([400, 200, 400]);
    const tituloOriginal = document.title;
    document.title = '⚠ ALERTA — VacTy';
    if (!sonido) return () => void (document.title = tituloOriginal);
    sonarPitido();
    const id = window.setInterval(sonarPitido, 1500);
    return () => {
      window.clearInterval(id);
      document.title = tituloOriginal;
    };
  }, [alarma?.id, sonido]);

  const cambiarSonido = useCallback((activo: boolean) => {
    if (activo) prepararAudio();
    setSonido(activo);
    guardar('sonido', activo);
  }, []);

  const ultima = serie.length ? serie[serie.length - 1] : null;

  const valor = useMemo<TiempoRealCtx>(
    () => ({
      estadoSensor,
      estadoAlertas,
      ultima,
      serie,
      alertasEnVivo,
      alertasAbiertas,
      alarma,
      marcarVista,
      pendientes: pendientes.length,
      sonido,
      cambiarSonido,
    }),
    [estadoSensor, estadoAlertas, ultima, serie, alertasEnVivo, alertasAbiertas, alarma, marcarVista, pendientes, sonido, cambiarSonido],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useTiempoReal(): TiempoRealCtx {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useTiempoReal debe usarse dentro de TiempoRealProvider');
  return ctx;
}
