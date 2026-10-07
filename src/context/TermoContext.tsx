import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, esErrorDeConexion, mensajeDeError } from '../api/http';
import {
  actualizarDispositivo,
  asignarPerfilAContenedor,
  crearDispositivo,
  crearPerfilVacuna,
  listarPerfilesVacuna,
  obtenerDispositivo,
} from '../api/servicios';
import type { PerfilVacuna } from '../api/tipos';
import { claveUsuario, guardarCache, leerCache } from '../lib/storage';
import { armarTermo, codificarDireccion, mismoValor, nombrePerfil, type Termo, type VacunaTermo } from '../lib/termo';
import { useDni } from './SesionContext';

export interface DatosTermo {
  nombre: string;
  contenedor: string;
  vacunas: VacunaTermo[];
}

interface TermoCtx {
  termo: Termo | null;
  cargando: boolean;
  error: string | null;
  /** Fecha del dato guardado cuando no se pudo consultar al servidor. */
  desdeCache: string | null;
  recargar(): Promise<void>;
  guardarTermo(datos: DatosTermo): Promise<void>;
}

const Contexto = createContext<TermoCtx | null>(null);

/** Reutiliza el perfil si ya existe con el mismo nombre y rango; si no, lo crea. */
async function obtenerOCrearPerfil(vacunas: VacunaTermo[]): Promise<PerfilVacuna> {
  const { min, max } = vacunas[0];
  const sensible = vacunas.some((v) => v.sensibleCongelacion);
  const base = nombrePerfil(vacunas, min, max);
  const igual = (p: PerfilVacuna) =>
    mismoValor(p.minTemp, min) && mismoValor(p.maxTemp, max) && p.freezeSensitive === sensible;

  for (let intento = 0; intento < 2; intento++) {
    const perfiles = await listarPerfilesVacuna();
    const existente = perfiles.find((p) => (p.name === base || p.name.startsWith(`${base} #`)) && igual(p));
    if (existente) return existente;

    let nombre = base;
    for (let n = 2; perfiles.some((p) => p.name === nombre); n++) nombre = `${base} #${n}`;
    try {
      return await crearPerfilVacuna({ name: nombre, minTemp: min, maxTemp: max, freezeSensitive: sensible });
    } catch (e) {
      // Otro usuario pudo crear el mismo nombre al mismo tiempo: se vuelve a consultar una vez.
      if (!(e instanceof ApiError && e.status === 400) || intento === 1) throw e;
    }
  }
  throw new ApiError(400, 'No se pudo guardar el rango de temperatura de las vacunas.');
}

export function TermoProvider({ children }: { children: ReactNode }) {
  const dni = useDni();
  const claveCache = claveUsuario(dni, 'termo');
  const [termo, setTermo] = useState<Termo | null>(() => leerCache<Termo | null>(claveCache)?.datos ?? null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [desdeCache, setDesdeCache] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [dispositivo, perfiles] = await Promise.all([obtenerDispositivo(), listarPerfilesVacuna()]);
      const nuevo = armarTermo(dispositivo, perfiles);
      setTermo(nuevo);
      setDesdeCache(null);
      guardarCache(claveCache, nuevo);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setTermo(null);
        setDesdeCache(null);
        guardarCache(claveCache, null);
      } else if (esErrorDeConexion(e)) {
        const cache = leerCache<Termo | null>(claveCache);
        if (cache) {
          setTermo(cache.datos);
          setDesdeCache(cache.guardadoEn);
        } else setError(mensajeDeError(e));
      } else setError(mensajeDeError(e));
    } finally {
      setCargando(false);
    }
  }, [claveCache]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  useEffect(() => {
    if (!desdeCache) return;
    const alVolver = () => void recargar();
    window.addEventListener('online', alVolver);
    return () => window.removeEventListener('online', alVolver);
  }, [desdeCache, recargar]);

  const guardarTermo = useCallback(
    async ({ nombre, contenedor, vacunas }: DatosTermo) => {
      const perfil = await obtenerOCrearPerfil(vacunas);
      await asignarPerfilAContenedor(contenedor, perfil.id);
      const direccion = codificarDireccion(contenedor, perfil.id);
      // Un solo termo por cuenta: POST solo si aún no tiene; si no, PUT.
      if (termo) await actualizarDispositivo(nombre, direccion);
      else await crearDispositivo(nombre, direccion);
      await recargar();
    },
    [termo, recargar],
  );

  const valor = useMemo<TermoCtx>(
    () => ({ termo, cargando, error, desdeCache, recargar, guardarTermo }),
    [termo, cargando, error, desdeCache, recargar, guardarTermo],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useTermo(): TermoCtx {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useTermo debe usarse dentro de TermoProvider');
  return ctx;
}
