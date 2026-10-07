import { API_URL } from '../config';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const MENSAJES_GENERICOS: Record<number, string> = {
  0: 'No hay conexión con el servidor. Revisa tu internet.',
  400: 'Los datos enviados no son válidos.',
  401: 'Tu sesión terminó. Vuelve a iniciar sesión.',
  403: 'No tienes permiso para hacer esto.',
  404: 'No se encontró la información solicitada.',
  409: 'La operación entra en conflicto con los datos actuales.',
  429: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
  500: 'El servidor no pudo completar la operación. Inténtalo de nuevo.',
  502: 'El servidor no está disponible en este momento.',
  503: 'El servidor no está disponible en este momento.',
  504: 'El servidor tardó demasiado en responder.',
};

/** true si el error se debe a que no hay red o el backend no responde (no a datos inválidos). */
export function esErrorDeConexion(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 0 || error.status >= 502);
}

let alNoAutorizado: (() => void) | null = null;

/** La sesión registra aquí qué hacer ante un 401 (volver al inicio de sesión). */
export function configurarNoAutorizado(fn: (() => void) | null): void {
  alNoAutorizado = fn;
}

/**
 * Termos, lotes, vacunas y todos los 403 y 429 traen el motivo listo para mostrar en `message`.
 * Autenticación y perfil responden el error genérico de Spring, sin motivo: ahí manda `mensajes`.
 */
export function motivoDelServidor(cuerpo: string): string | null {
  try {
    const datos = JSON.parse(cuerpo) as { message?: unknown } | null;
    return typeof datos?.message === 'string' && datos.message.trim() ? datos.message.trim() : null;
  } catch {
    return null;
  }
}

interface Opciones {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Mensaje según el código, para los endpoints que no envían el motivo del error. */
  mensajes?: Partial<Record<number, string>>;
  /** Para las rutas de sesión, donde un 401 no significa "sesión vencida". */
  ignorar401?: boolean;
  signal?: AbortSignal;
}

export async function solicitar<T = void>(ruta: string, opciones: Opciones = {}): Promise<T> {
  const { method = 'GET', body, mensajes, ignorar401, signal } = opciones;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${ruta}`, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError(0, MENSAJES_GENERICOS[0]);
  }

  if (!res.ok) {
    if (res.status === 401 && !ignorar401) alNoAutorizado?.();
    const delServidor = res.status === 401 ? null : motivoDelServidor(await res.text().catch(() => ''));
    const mensaje =
      delServidor ??
      mensajes?.[res.status] ??
      MENSAJES_GENERICOS[res.status] ??
      `Error inesperado del servidor (${res.status}).`;
    throw new ApiError(res.status, mensaje);
  }

  const texto = await res.text();
  return (texto ? JSON.parse(texto) : undefined) as T;
}

export function mensajeDeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
}
