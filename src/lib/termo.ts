import type { Dispositivo, PerfilVacuna } from '../api/tipos';
import { buscarEnCatalogo } from './vacunas';

export interface VacunaTermo {
  nombre: string;
  min: number;
  max: number;
  sensibleCongelacion: boolean;
}

export interface Termo {
  deviceId: string;
  nombre: string;
  /** Código con el que el sensor publica su telemetría (p. ej. "001"). */
  contenedor: string;
  vacunas: VacunaTermo[];
  min: number;
  max: number;
  sensibleCongelacion: boolean;
  profileId: number | null;
}

/** Rango que el backend usa para los contenedores sin perfil asignado. */
export const RANGO_POR_DEFECTO = { min: 2, max: 8 };

// El backend guarda el dispositivo con un texto libre ("deviceConnectionAddress") que no usa.
// Ahí se guarda el código del contenedor y el perfil asignado, para recuperar el termo desde
// cualquier navegador: "contenedor:001;perfil:5".
export function codificarDireccion(contenedor: string, profileId: number): string {
  return `contenedor:${contenedor};perfil:${profileId}`;
}

export function decodificarDireccion(texto: string): { contenedor: string; profileId: number | null } {
  const c = /contenedor:([^;]+)/.exec(texto);
  const p = /perfil:(\d+)/.exec(texto);
  return {
    contenedor: (c ? c[1] : texto).trim(),
    profileId: p ? Number(p[1]) : null,
  };
}

/** Nombre del perfil en el backend: "Pentavalente + Neumococo conjugada (2 a 8 °C)". */
export function nombrePerfil(vacunas: VacunaTermo[], min: number, max: number): string {
  return `${vacunas.map((v) => v.nombre).join(' + ')} (${min} a ${max} °C)`;
}

const SUFIJO_RANGO = /\s\((-?[\d.]+) a (-?[\d.]+) °C\)(\s#\d+)?$/;

export function vacunasDesdePerfil(perfil: PerfilVacuna): VacunaTermo[] {
  if (!SUFIJO_RANGO.test(perfil.name)) return [];
  return perfil.name
    .replace(SUFIJO_RANGO, '')
    .split(' + ')
    .map((n) => n.trim())
    .filter(Boolean)
    .map((nombre) => ({
      nombre,
      min: perfil.minTemp,
      max: perfil.maxTemp,
      sensibleCongelacion: buscarEnCatalogo(nombre)?.sensibleCongelacion ?? perfil.freezeSensitive,
    }));
}

export function armarTermo(dispositivo: Dispositivo, perfiles: PerfilVacuna[]): Termo {
  const { contenedor, profileId } = decodificarDireccion(dispositivo.deviceConnectionAddress);
  const perfil = profileId == null ? undefined : perfiles.find((p) => p.id === profileId);
  return {
    deviceId: dispositivo.deviceId,
    nombre: dispositivo.deviceName,
    contenedor,
    vacunas: perfil ? vacunasDesdePerfil(perfil) : [],
    min: perfil?.minTemp ?? RANGO_POR_DEFECTO.min,
    max: perfil?.maxTemp ?? RANGO_POR_DEFECTO.max,
    sensibleCongelacion: perfil?.freezeSensitive ?? true,
    profileId: perfil?.id ?? null,
  };
}

export function mismoValor(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9;
}

export type EstadoTemperatura = 'sin_dato' | 'ok' | 'congelacion' | 'bajo' | 'alto';

export function estadoTemperatura(
  temp: number | null | undefined,
  rango: { min: number; max: number; sensibleCongelacion: boolean },
): EstadoTemperatura {
  if (typeof temp !== 'number' || !Number.isFinite(temp)) return 'sin_dato';
  if (temp < rango.min) return rango.sensibleCongelacion ? 'congelacion' : 'bajo';
  if (temp > rango.max) return 'alto';
  return 'ok';
}

export const TEXTO_ESTADO_TEMPERATURA: Record<EstadoTemperatura, string> = {
  sin_dato: 'Sin lectura válida',
  ok: 'En rango',
  congelacion: 'Riesgo de congelación',
  bajo: 'Por debajo del rango',
  alto: 'Por encima del rango',
};
