import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, configurarNoAutorizado, esErrorDeConexion } from '../api/http';
import { cerrarSesion, iniciarSesion, obtenerPerfil, registrarse } from '../api/servicios';
import { borrar, guardar, leer } from '../lib/storage';

type EstadoSesion =
  | { tipo: 'cargando' }
  | { tipo: 'anonimo' }
  /** sinVerificar = sin conexión con el servidor; se usa la última sesión conocida. */
  | { tipo: 'autenticado'; dni: string; sinVerificar: boolean };

interface SesionCtx {
  sesion: EstadoSesion;
  ingresar(dni: string, contrasena: string): Promise<void>;
  crearCuenta(dni: string, contrasena: string): Promise<void>;
  salir(): Promise<void>;
}

const Contexto = createContext<SesionCtx | null>(null);
const CLAVE_SESION = 'sesion';

export function SesionProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<EstadoSesion>({ tipo: 'cargando' });

  const marcarAutenticado = useCallback((dni: string) => {
    guardar(CLAVE_SESION, { dni });
    setSesion({ tipo: 'autenticado', dni, sinVerificar: false });
  }, []);

  const marcarAnonimo = useCallback(() => {
    borrar(CLAVE_SESION);
    setSesion({ tipo: 'anonimo' });
  }, []);

  const verificar = useCallback(async () => {
    const guardada = leer<{ dni: string } | null>(CLAVE_SESION, null);
    try {
      const perfil = await obtenerPerfil();
      marcarAutenticado(perfil.profileDni);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404 && guardada) marcarAutenticado(guardada.dni);
      else if (esErrorDeConexion(e) && guardada) setSesion({ tipo: 'autenticado', dni: guardada.dni, sinVerificar: true });
      else marcarAnonimo();
    }
  }, [marcarAutenticado, marcarAnonimo]);

  useEffect(() => {
    void verificar();
  }, [verificar]);

  // Si se abrió sin internet, se confirma la sesión apenas vuelve la conexión.
  useEffect(() => {
    if (sesion.tipo !== 'autenticado' || !sesion.sinVerificar) return;
    const alVolver = () => void verificar();
    window.addEventListener('online', alVolver);
    return () => window.removeEventListener('online', alVolver);
  }, [sesion, verificar]);

  useEffect(() => {
    configurarNoAutorizado(marcarAnonimo);
    return () => configurarNoAutorizado(null);
  }, [marcarAnonimo]);

  const valor = useMemo<SesionCtx>(
    () => ({
      sesion,
      async ingresar(dni, contrasena) {
        await iniciarSesion(dni, contrasena);
        marcarAutenticado(dni);
      },
      async crearCuenta(dni, contrasena) {
        await registrarse(dni, contrasena);
        marcarAutenticado(dni);
      },
      async salir() {
        try {
          await cerrarSesion();
        } finally {
          marcarAnonimo();
        }
      },
    }),
    [sesion, marcarAutenticado, marcarAnonimo],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): SesionCtx {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useSesion debe usarse dentro de SesionProvider');
  return ctx;
}

/** DNI del usuario con sesión. Solo para pantallas protegidas. */
export function useDni(): string {
  const { sesion } = useSesion();
  if (sesion.tipo !== 'autenticado') throw new Error('No hay sesión activa');
  return sesion.dni;
}
