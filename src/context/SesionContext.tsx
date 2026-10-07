import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, configurarNoAutorizado, esErrorDeConexion } from '../api/http';
import { actualizarPerfil, cerrarSesion, iniciarSesion, obtenerPerfil, registrarse } from '../api/servicios';
import type { Perfil, Rol } from '../api/tipos';
import { borrar, guardar, leer } from '../lib/storage';

interface Usuario {
  dni: string;
  rol: Rol;
  /** Nombre y apellido; null si aún no completó su perfil. */
  nombre: string | null;
  perfilCompleto: boolean;
}

type EstadoSesion =
  | { tipo: 'cargando' }
  | { tipo: 'anonimo' }
  /** sinVerificar = sin conexión con el servidor; se usa la última sesión conocida. */
  | ({ tipo: 'autenticado'; sinVerificar: boolean } & Usuario);

export interface DatosPersona {
  nombre: string;
  apellido: string;
  establecimiento: string;
}

interface SesionCtx {
  sesion: EstadoSesion;
  ingresar(dni: string, contrasena: string): Promise<void>;
  crearCuenta(dni: string, contrasena: string, datos: DatosPersona): Promise<void>;
  guardarDatos(datos: DatosPersona): Promise<void>;
  salir(): Promise<void>;
}

const Contexto = createContext<SesionCtx | null>(null);
const CLAVE_SESION = 'sesion';

/** El backend crea el perfil con "Undefined" en nombre, apellido y empresa. */
export function textoPerfil(valor: string | null | undefined): string {
  const v = (valor ?? '').trim();
  return v.toLowerCase() === 'undefined' ? '' : v;
}

export function usuarioDesdePerfil(p: Perfil): Usuario {
  const nombre = textoPerfil(p.profileName);
  const apellido = textoPerfil(p.profileLastName);
  return {
    dni: p.profileDni,
    rol: p.role === 'SUPERVISOR' ? 'SUPERVISOR' : 'ENFERMERA',
    nombre: [nombre, apellido].filter(Boolean).join(' ') || null,
    perfilCompleto: Boolean(nombre && apellido && textoPerfil(p.profileCompany)),
  };
}

export function SesionProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<EstadoSesion>({ tipo: 'cargando' });

  const marcarAutenticado = useCallback((usuario: Usuario) => {
    guardar(CLAVE_SESION, usuario);
    setSesion({ tipo: 'autenticado', sinVerificar: false, ...usuario });
  }, []);

  const marcarAnonimo = useCallback(() => {
    borrar(CLAVE_SESION);
    setSesion({ tipo: 'anonimo' });
  }, []);

  /** Lee el perfil (rol y nombre). Sin perfil (404), se queda con lo conocido. */
  const cargarPerfil = useCallback(
    async (dni: string) => {
      try {
        marcarAutenticado(usuarioDesdePerfil(await obtenerPerfil()));
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 404)) throw e;
        const guardada = leer<Partial<Usuario> | null>(CLAVE_SESION, null);
        marcarAutenticado({ dni, rol: guardada?.rol ?? 'ENFERMERA', nombre: null, perfilCompleto: false });
      }
    },
    [marcarAutenticado],
  );

  const verificar = useCallback(async () => {
    const guardada = leer<Partial<Usuario> | null>(CLAVE_SESION, null);
    const conocida: Usuario | null = guardada?.dni
      ? {
          dni: guardada.dni,
          rol: guardada.rol ?? 'ENFERMERA',
          nombre: guardada.nombre ?? null,
          perfilCompleto: guardada.perfilCompleto ?? false,
        }
      : null;
    try {
      marcarAutenticado(usuarioDesdePerfil(await obtenerPerfil()));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404 && conocida) marcarAutenticado(conocida);
      else if (esErrorDeConexion(e) && conocida) setSesion({ tipo: 'autenticado', sinVerificar: true, ...conocida });
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
        await cargarPerfil(dni);
      },
      async crearCuenta(dni, contrasena, datos) {
        await registrarse(dni, contrasena);
        try {
          await actualizarPerfil(datos.nombre, datos.apellido, datos.establecimiento);
        } catch {
          // la cuenta ya existe: si falla, la app le pide completar sus datos después
        }
        await cargarPerfil(dni);
      },
      async guardarDatos(datos) {
        if (sesion.tipo !== 'autenticado') return;
        await actualizarPerfil(datos.nombre, datos.apellido, datos.establecimiento);
        await cargarPerfil(sesion.dni);
      },
      async salir() {
        try {
          await cerrarSesion();
        } finally {
          marcarAnonimo();
        }
      },
    }),
    [sesion, cargarPerfil, marcarAnonimo],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): SesionCtx {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useSesion debe usarse dentro de SesionProvider');
  return ctx;
}

/** Usuario con sesión. Solo para pantallas protegidas. */
export function useUsuario(): Usuario {
  const { sesion } = useSesion();
  if (sesion.tipo !== 'autenticado') throw new Error('No hay sesión activa');
  return sesion;
}

/** DNI del usuario con sesión. Solo para pantallas protegidas. */
export function useDni(): string {
  return useUsuario().dni;
}

export function useEsSupervisor(): boolean {
  return useUsuario().rol === 'SUPERVISOR';
}
