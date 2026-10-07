import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { esErrorDeConexion, mensajeDeError } from '../api/http';
import { entregarTermo, misTermos, todosLosTermos, vincularTermo } from '../api/servicios';
import type { ResultadoVinculo, Termo } from '../api/tipos';
import { claveUsuario, guardar, guardarCache, leer, leerCache } from '../lib/storage';
import { nombreTermo } from '../lib/termo';
import { useUsuario } from './SesionContext';

interface TermoCtx {
  /** Enfermera: sus termos vinculados. Supervisor: todos. */
  termos: Termo[];
  /** Termo que se muestra en En vivo, Historial y Lotes. */
  termo: Termo | null;
  elegir(contenedor: string): void;
  cargando: boolean;
  error: string | null;
  /** Fecha del dato guardado cuando no se pudo consultar al servidor. */
  desdeCache: string | null;
  /** Aviso cuando un termo de la enfermera pasó a otra persona. */
  perdido: string | null;
  descartarPerdido(): void;
  recargar(): Promise<void>;
  /** Recarga en segundo plano, agrupando varios avisos seguidos. */
  recargarPronto(): void;
  vincular(codigo: string, clave: string): Promise<ResultadoVinculo>;
  entregar(codigo: string): Promise<void>;
}

const Contexto = createContext<TermoCtx | null>(null);
const REFRESCO_MS = 60_000;

export function TermoProvider({ children }: { children: ReactNode }) {
  const { dni, rol } = useUsuario();
  const supervisor = rol === 'SUPERVISOR';
  const claveCache = claveUsuario(dni, `termos:${rol}`);
  const claveActivo = claveUsuario(dni, 'termo-activo');

  const [termos, setTermos] = useState<Termo[]>(() => leerCache<Termo[]>(claveCache)?.datos ?? []);
  const [activo, setActivo] = useState<string | null>(() => leer<string | null>(claveActivo, null));
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [desdeCache, setDesdeCache] = useState<string | null>(null);
  const [perdido, setPerdido] = useState<string | null>(null);

  const anteriores = useRef<Termo[] | null>(null);
  const entregados = useRef(new Set<string>());

  const cargar = useCallback(
    async (silencioso: boolean) => {
      if (!silencioso) {
        setCargando(true);
        setError(null);
      }
      try {
        const lista = await (supervisor ? todosLosTermos() : misTermos());
        lista.sort((a, b) => a.contenedor.localeCompare(b.contenedor, 'es', { numeric: true }));
        // La enfermera deja de ver un termo cuando otra persona lo vincula o el supervisor se lo quita.
        if (!supervisor && anteriores.current) {
          const quitados = anteriores.current.filter(
            (t) => !lista.some((n) => n.contenedor === t.contenedor) && !entregados.current.has(t.contenedor),
          );
          if (quitados.length)
            setPerdido(
              `Ya no tienes ${quitados.map(nombreTermo).join(', ')}: otra persona lo vinculó o el supervisor lo desvinculó.`,
            );
        }
        entregados.current.clear();
        anteriores.current = lista;
        setTermos(lista);
        setDesdeCache(null);
        setError(null);
        guardarCache(claveCache, lista);
      } catch (e) {
        if (silencioso) return;
        const cache = leerCache<Termo[]>(claveCache);
        if (esErrorDeConexion(e) && cache) {
          setTermos(cache.datos);
          setDesdeCache(cache.guardadoEn);
        } else setError(mensajeDeError(e));
      } finally {
        if (!silencioso) setCargando(false);
      }
    },
    [supervisor, claveCache],
  );

  const recargar = useCallback(() => cargar(false), [cargar]);

  const pendiente = useRef<number | undefined>(undefined);
  const recargarPronto = useCallback(() => {
    if (pendiente.current) return;
    pendiente.current = window.setTimeout(() => {
      pendiente.current = undefined;
      void cargar(true);
    }, 1500);
  }, [cargar]);

  useEffect(() => {
    void cargar(false);
    const id = window.setInterval(() => {
      if (navigator.onLine) void cargar(true);
    }, REFRESCO_MS);
    const alVolver = () => void cargar(true);
    window.addEventListener('online', alVolver);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(pendiente.current);
      window.removeEventListener('online', alVolver);
    };
  }, [cargar]);

  const elegir = useCallback(
    (contenedor: string) => {
      setActivo(contenedor);
      guardar(claveActivo, contenedor);
    },
    [claveActivo],
  );

  const vincular = useCallback(
    async (codigo: string, clave: string) => {
      const resultado = await vincularTermo(codigo, clave);
      elegir(resultado.contenedor);
      await cargar(true);
      return resultado;
    },
    [cargar, elegir],
  );

  const entregar = useCallback(
    async (codigo: string) => {
      await entregarTermo(codigo);
      entregados.current.add(codigo);
      await cargar(true);
    },
    [cargar],
  );

  const termo = termos.find((t) => t.contenedor === activo) ?? termos[0] ?? null;

  const valor = useMemo<TermoCtx>(
    () => ({
      termos,
      termo,
      elegir,
      cargando,
      error,
      desdeCache,
      perdido,
      descartarPerdido: () => setPerdido(null),
      recargar,
      recargarPronto,
      vincular,
      entregar,
    }),
    [termos, termo, elegir, cargando, error, desdeCache, perdido, recargar, recargarPronto, vincular, entregar],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useTermo(): TermoCtx {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useTermo debe usarse dentro de TermoProvider');
  return ctx;
}
