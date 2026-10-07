import { formatoRango } from './format';
import { mismoValor, type VacunaTermo } from './termo';

export function validarDni(dni: string): string | null {
  if (!dni.trim()) return 'Ingresa tu DNI.';
  if (!/^\d{8}$/.test(dni.trim())) return 'El DNI debe tener exactamente 8 dígitos.';
  return null;
}

/** El backend usa bcrypt: más de 72 bytes da error. */
export function validarContrasena(contrasena: string): string | null {
  if (!contrasena) return 'Ingresa una contraseña.';
  if (contrasena.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (new TextEncoder().encode(contrasena).length > 72) return 'La contraseña es demasiado larga (máximo 72 caracteres).';
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(contrasena) || !/\d/.test(contrasena))
    return 'La contraseña debe tener al menos una letra y un número.';
  return null;
}

export function validarNombreTermo(nombre: string): string | null {
  const n = nombre.trim();
  if (!n) return 'Ingresa un nombre para el termo.';
  if (n.length < 2 || n.length > 40) return 'El nombre debe tener entre 2 y 40 caracteres.';
  return null;
}

export function validarContenedor(codigo: string): string | null {
  const c = codigo.trim();
  if (!c) return 'Ingresa el código del sensor.';
  if (!/^[A-Za-z0-9_-]{1,20}$/.test(c)) return 'Usa solo letras, números, guion o guion bajo (máximo 20).';
  return null;
}

export const TEMP_MINIMA_PERMITIDA = -50;
export const TEMP_MAXIMA_PERMITIDA = 30;

export interface ResultadoRango {
  min?: number;
  max?: number;
  errorMin?: string;
  errorMax?: string;
}

function leerTemperatura(texto: string, campo: string): { valor?: number; error?: string } {
  const t = texto.trim().replace(',', '.');
  if (!t) return { error: `Ingresa la temperatura ${campo}.` };
  if (!/^-?\d+(\.\d)?$/.test(t)) return { error: 'Usa un número con máximo un decimal (p. ej. 2 o 2.5).' };
  const valor = Number(t);
  if (valor < TEMP_MINIMA_PERMITIDA || valor > TEMP_MAXIMA_PERMITIDA)
    return { error: `Debe estar entre ${TEMP_MINIMA_PERMITIDA} y ${TEMP_MAXIMA_PERMITIDA} °C.` };
  return { valor };
}

export function validarRango(minTexto: string, maxTexto: string): ResultadoRango {
  const min = leerTemperatura(minTexto, 'mínima');
  const max = leerTemperatura(maxTexto, 'máxima');
  const r: ResultadoRango = { min: min.valor, max: max.valor, errorMin: min.error, errorMax: max.error };
  if (r.min !== undefined && r.max !== undefined && r.min >= r.max)
    r.errorMax = 'La máxima debe ser mayor que la mínima.';
  return r;
}

export function validarNombreVacuna(nombre: string): string | null {
  const n = nombre.trim();
  if (!n) return 'Elige o escribe el tipo de vacuna.';
  if (n.length > 40) return 'El nombre de la vacuna admite máximo 40 caracteres.';
  if (n.includes('+')) return 'El nombre de la vacuna no puede contener el signo "+".';
  return null;
}

/**
 * Un termo solo puede llevar vacunas que se conservan en el mismo rango de temperatura:
 * con rangos distintos, una de ellas quedaría siempre fuera de su rango seguro.
 */
export function validarNuevaVacuna(nueva: VacunaTermo, actuales: VacunaTermo[]): string | null {
  const errorNombre = validarNombreVacuna(nueva.nombre);
  if (errorNombre) return errorNombre;

  const nombre = nueva.nombre.trim().toLocaleLowerCase('es');
  if (actuales.some((v) => v.nombre.toLocaleLowerCase('es') === nombre))
    return `«${nueva.nombre.trim()}» ya está en la lista de este termo.`;

  const distinta = actuales.find((v) => !mismoValor(v.min, nueva.min) || !mismoValor(v.max, nueva.max));
  if (distinta)
    return (
      `No se puede agregar «${nueva.nombre.trim()}» (${formatoRango(nueva.min, nueva.max)}): ` +
      `el termo ya lleva «${distinta.nombre}» (${formatoRango(distinta.min, distinta.max)}). ` +
      'Todas las vacunas de un termo deben tener el mismo rango de temperatura.'
    );
  return null;
}
