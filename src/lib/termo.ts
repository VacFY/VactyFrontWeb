import type { EstadoTermo, MotivoCierre, RangoTermo, Termo } from '../api/tipos';
import { formatoRango } from './format';

/** Rango que usa el backend si un termo no tiene lotes ni perfil. */
export const RANGO_POR_DEFECTO: RangoTermo = {
  minTemp: 2,
  maxTemp: 8,
  basedOn: 'PROFILE',
  profileName: 'PAI estándar 2–8 °C',
  freezeSensitive: true,
  heatSensitive: false,
};

export function rangoDe(termo: Termo | null | undefined): RangoTermo {
  return termo?.range ?? RANGO_POR_DEFECTO;
}

export function nombreTermo(termo: Pick<Termo, 'nombre' | 'contenedor'>): string {
  return termo.nombre?.trim() || `Termo ${termo.contenedor}`;
}

/** "2,0 a 8,0 °C · según los lotes" o "… · perfil PAI estándar 2–8 °C". */
export function textoRango(rango: RangoTermo): string {
  const origen = rango.basedOn === 'LOTS' ? 'según los lotes' : `perfil ${rango.profileName ?? 'estándar'}`;
  return `${formatoRango(rango.minTemp, rango.maxTemp)} · ${origen}`;
}

export const TEXTO_ESTADO_TERMO: Record<EstadoTermo, string> = {
  OK: 'En orden',
  ALERTA: 'Con alertas',
  SIN_DATOS: 'Sin datos',
};

export const TEXTO_MOTIVO_CIERRE: Record<MotivoCierre, string> = {
  ENTREGADO: 'Entregado',
  TOMADO_POR_OTRA: 'Lo tomó otra persona',
  DESVINCULADO_POR_SUPERVISOR: 'Desvinculado por el supervisor',
};

/** Texto de un QR del termo, "vacty:<codigo>:<clave>". Devuelve null si no tiene ese formato. */
export function separarQr(texto: string): { codigo: string; clave: string } | null {
  const m = /^\s*vacty:([A-Za-z0-9_-]{1,32}):([A-Za-z0-9 -]{4,})\s*$/i.exec(texto);
  return m ? { codigo: m[1], clave: m[2].trim() } : null;
}

export function validarCodigoTermo(codigo: string): string | null {
  const c = codigo.trim();
  if (!c) return 'Ingresa el código del termo.';
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(c)) return 'Usa solo letras, números, guion o guion bajo (máximo 32).';
  return null;
}

export function validarNombreTermo(nombre: string): string | null {
  const n = nombre.trim();
  if (!n) return 'Ingresa un nombre para el termo.';
  if (n.length < 2 || n.length > 60) return 'El nombre debe tener entre 2 y 60 caracteres.';
  return null;
}

export function validarClave(clave: string): string | null {
  const c = clave.replace(/[\s-]/g, '');
  if (!c) return 'Ingresa la clave impresa en la etiqueta del termo.';
  if (c.length < 4) return 'La clave está incompleta.';
  return null;
}

export type EstadoTemperatura = 'sin_dato' | 'ok' | 'congelacion' | 'bajo' | 'alto';

export function estadoTemperatura(temp: number | null | undefined, rango: RangoTermo): EstadoTemperatura {
  if (typeof temp !== 'number' || !Number.isFinite(temp)) return 'sin_dato';
  if (temp < rango.minTemp) return rango.freezeSensitive ? 'congelacion' : 'bajo';
  if (temp > rango.maxTemp) return 'alto';
  return 'ok';
}

export const TEXTO_ESTADO_TEMPERATURA: Record<EstadoTemperatura, string> = {
  sin_dato: 'Sin lectura válida',
  ok: 'En rango',
  congelacion: 'Riesgo de congelación',
  bajo: 'Por debajo del rango',
  alto: 'Por encima del rango',
};
