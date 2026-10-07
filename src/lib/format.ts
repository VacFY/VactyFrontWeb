const unDecimal = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fechaHora = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' });
const hora = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit' });
const fechaLarga = new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });

export function esNumero(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor);
}

export function formatoTemp(t: number | null | undefined): string {
  return esNumero(t) ? `${unDecimal.format(t)} °C` : '—';
}

export function formatoHumedad(h: number | null | undefined): string {
  return esNumero(h) ? `${Math.round(h)} %` : '—';
}

export function formatoRango(min: number, max: number): string {
  return `${unDecimal.format(min)} a ${unDecimal.format(max)} °C`;
}

export function formatoFechaHora(valor: string | number | Date): string {
  return fechaHora.format(new Date(valor));
}

export function formatoHora(valor: string | number | Date): string {
  return hora.format(new Date(valor));
}

/** Fecha "AAAA-MM-DD" (sin hora) mostrada en formato local. */
export function formatoFecha(iso: string): string {
  return fechaLarga.format(fechaLocal(iso));
}

export function fechaLocal(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

/** Hoy en formato "AAAA-MM-DD", según la hora del dispositivo. */
export function hoyISO(ahora: Date = new Date()): string {
  const m = String(ahora.getMonth() + 1).padStart(2, '0');
  const d = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${m}-${d}`;
}

/** Días calendario desde hoy hasta la fecha. Negativo = ya pasó. */
export function diasHasta(iso: string, hoy: string = hoyISO()): number {
  return Math.round((fechaLocal(iso).getTime() - fechaLocal(hoy).getTime()) / 86_400_000);
}

export function haceCuanto(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `hace ${s} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

/** Valor para <input type="datetime-local"> en hora local. */
export function aInputFechaHora(fecha: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}T${p(fecha.getHours())}:${p(fecha.getMinutes())}`;
}
