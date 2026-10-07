import { solicitar } from './http';
import type {
  Alerta,
  Asignacion,
  ClaveTermo,
  FiltroAlertas,
  LecturaCodigo,
  Lectura,
  LoteApi,
  NuevoLote,
  Perfil,
  ResultadoVinculo,
  Termo,
  Vacuna,
} from './tipos';

const ruta = (texto: string) => encodeURIComponent(texto);

// ── Autenticación y perfil ─────────────────────────────────────
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

/** Ticket de un solo uso (60 s) para abrir un WebSocket: la cookie no viaja si el front está en otro dominio. */
export function pedirTicketWs() {
  return solicitar<{ ticket: string; expiresInSeconds: number }>('/api/v1/authentication/ws-ticket', { method: 'POST' });
}

export function obtenerPerfil() {
  return solicitar<Perfil>('/api/v1/profile', { ignorar401: true });
}

export function actualizarPerfil(nombre: string, apellido: string, establecimiento: string) {
  return solicitar('/api/v1/profile', {
    method: 'PUT',
    body: { profileName: nombre, profileLastName: apellido, profileCompany: establecimiento },
    mensajes: { 500: 'No se pudieron guardar tus datos. Revisa que ningún campo esté vacío.' },
  });
}

// ── Termos ─────────────────────────────────────────────────────
export function misTermos() {
  return solicitar<Termo[]>('/api/v1/my/containers');
}

export function todosLosTermos() {
  return solicitar<Termo[]>('/api/v1/containers');
}

export function vincularTermo(codigo: string, clave: string) {
  return solicitar<ResultadoVinculo>('/api/v1/containers/link', { method: 'POST', body: { codigo, clave } });
}

export function entregarTermo(codigo: string) {
  return solicitar(`/api/v1/containers/${ruta(codigo)}/unlink`, { method: 'POST' });
}

export function registrarTermo(codigo: string, nombre: string) {
  return solicitar<ClaveTermo>('/api/v1/containers', { method: 'POST', body: { codigo, nombre } });
}

export function regenerarClave(codigo: string) {
  return solicitar<ClaveTermo>(`/api/v1/containers/${ruta(codigo)}/regenerate-key`, { method: 'POST' });
}

export function historialAsignaciones(codigo: string) {
  return solicitar<Asignacion[]>(`/api/v1/containers/${ruta(codigo)}/assignments`);
}

// ── Vacunas y lotes ────────────────────────────────────────────
export function listarVacunas() {
  return solicitar<Vacuna[]>('/api/v1/vaccines');
}

export function leerCodigo(code: string) {
  return solicitar<LecturaCodigo>('/api/v1/lots/read', { method: 'POST', body: { code } });
}

export function registrarLote(datos: NuevoLote) {
  return solicitar<LoteApi>('/api/v1/lots', { method: 'POST', body: datos });
}

export function lotesDelTermo(contenedor: string, incluirVencidos: boolean, signal?: AbortSignal) {
  return solicitar<LoteApi[]>(`/api/v1/containers/${ruta(contenedor)}/lots?includeExpired=${incluirVencidos}`, { signal });
}

export function lotesPorVencer(dias: number) {
  return solicitar<LoteApi[]>(`/api/v1/lots/expiring?days=${dias}`);
}

export function cerrarLote(lotId: number, status: 'USED' | 'DISCARDED', reason: string) {
  return solicitar<LoteApi>(`/api/v1/lots/${lotId}/close`, { method: 'PATCH', body: { status, reason } });
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
