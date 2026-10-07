import { solicitar } from './http';
import type { Alerta, Dispositivo, FiltroAlertas, Lectura, Perfil, PerfilVacuna } from './tipos';

// ── Autenticación ──────────────────────────────────────────────
export function iniciarSesion(dni: string, contrasena: string) {
  return solicitar('/api/v1/authentication/sign-in', {
    method: 'POST',
    body: { userDni: dni, userPassword: contrasena },
    ignorar401: true,
    mensajes: { 400: 'DNI o contraseña incorrectos.', 500: 'DNI o contraseña incorrectos.' },
  });
}

export function registrarse(dni: string, contrasena: string) {
  return solicitar('/api/v1/authentication/sign-up', {
    method: 'POST',
    body: { userDni: dni, userPassword: contrasena },
    ignorar401: true,
    mensajes: { 500: 'Ese DNI ya tiene una cuenta. Inicia sesión.' },
  });
}

export function cerrarSesion() {
  return solicitar('/api/v1/authentication/sign-out', { method: 'POST', ignorar401: true });
}

export function obtenerPerfil() {
  return solicitar<Perfil>('/api/v1/profile', { ignorar401: true });
}

// ── Termo (dispositivo) ────────────────────────────────────────
export function obtenerDispositivo() {
  return solicitar<Dispositivo>('/api/v1/device', {
    mensajes: { 500: 'No se pudo leer tu termo. Solo se admite un termo por cuenta.' },
  });
}

export function crearDispositivo(deviceName: string, deviceConnectionAddress: string) {
  return solicitar('/api/v1/device', {
    method: 'POST',
    body: { deviceName, deviceConnectionAddress },
    mensajes: { 500: 'No se pudo registrar el termo.' },
  });
}

export function actualizarDispositivo(deviceName: string, deviceConnectionAddress: string) {
  return solicitar('/api/v1/device', {
    method: 'PUT',
    body: { deviceName, deviceConnectionAddress },
    mensajes: { 500: 'No se pudo actualizar el termo.' },
  });
}

// ── Perfiles de vacuna (rango de temperatura por contenedor) ───
export function listarPerfilesVacuna() {
  return solicitar<PerfilVacuna[]>('/api/v1/vaccine-profiles');
}

export function crearPerfilVacuna(datos: Omit<PerfilVacuna, 'id'>) {
  return solicitar<PerfilVacuna>('/api/v1/vaccine-profiles', {
    method: 'POST',
    body: datos,
    mensajes: { 400: 'El servidor rechazó el rango de temperatura de las vacunas.' },
  });
}

export function asignarPerfilAContenedor(contenedor: string, profileId: number) {
  return solicitar<{ contenedor: string; profileId: number }>(
    `/api/v1/containers/${encodeURIComponent(contenedor)}/profile`,
    { method: 'PUT', body: { profileId }, mensajes: { 400: 'El perfil de vacunas no existe en el servidor.' } },
  );
}

// ── Alertas ────────────────────────────────────────────────────
export function listarAlertas(status: FiltroAlertas, contenedor?: string) {
  const q = new URLSearchParams({ status });
  if (contenedor) q.set('contenedor', contenedor);
  return solicitar<Alerta[]>(`/api/v1/alerts?${q}`);
}

export function marcarAlertaVista(id: number) {
  return solicitar<Alerta>(`/api/v1/alerts/${id}/acknowledge`, {
    method: 'PATCH',
    mensajes: { 404: 'La alerta ya no existe.' },
  });
}

// ── Lecturas ───────────────────────────────────────────────────
export function listarLecturas(contenedor: string, desde: Date, hasta: Date, signal?: AbortSignal) {
  const q = new URLSearchParams({ contenedor, from: desde.toISOString(), to: hasta.toISOString() });
  return solicitar<Lectura[]>(`/api/v1/readings?${q}`, { signal });
}

/** El backend devuelve como máximo 1000 lecturas por consulta. */
export const MAX_LECTURAS_POR_CONSULTA = 1000;
