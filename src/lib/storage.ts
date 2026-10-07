// localStorage puede no existir o fallar (modo privado, cuota llena): nunca debe romper la app.
const PREFIJO = 'vacty:';

export function leer<T>(clave: string, porDefecto: T): T {
  try {
    const raw = localStorage.getItem(PREFIJO + clave);
    return raw == null ? porDefecto : (JSON.parse(raw) as T);
  } catch {
    return porDefecto;
  }
}

export function guardar(clave: string, valor: unknown): boolean {
  try {
    localStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

export function borrar(clave: string): void {
  try {
    localStorage.removeItem(PREFIJO + clave);
  } catch {
    // sin almacenamiento disponible: no hay nada que borrar
  }
}

/** Clave separada por usuario, para que dos cuentas en el mismo navegador no mezclen datos. */
export function claveUsuario(dni: string, nombre: string): string {
  return `u:${dni}:${nombre}`;
}

export interface EnCache<T> {
  datos: T;
  guardadoEn: string;
}

export function guardarCache<T>(clave: string, datos: T): void {
  guardar(clave, { datos, guardadoEn: new Date().toISOString() } satisfies EnCache<T>);
}

export function leerCache<T>(clave: string): EnCache<T> | null {
  return leer<EnCache<T> | null>(clave, null);
}
