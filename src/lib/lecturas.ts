import { listarLecturas, MAX_LECTURAS_POR_CONSULTA } from '../api/servicios';
import type { Lectura } from '../api/tipos';
import { esNumero } from './format';

export const MINUTOS_POR_INTERVALO = 5;
const TRAMO_MS = 4 * 60 * 60 * 1000;
const TRAMO_MINIMO_MS = 15 * 60 * 1000;
const CONSULTAS_EN_PARALELO = 3;

/**
 * Trae todas las lecturas del rango. El backend corta en 1000 lecturas por consulta,
 * así que se pide por tramos y, si un tramo llega lleno, se divide en dos.
 */
export async function obtenerLecturasDelRango(
  contenedor: string,
  desde: Date,
  hasta: Date,
  signal?: AbortSignal,
): Promise<{ lecturas: Lectura[]; incompleto: boolean }> {
  let incompleto = false;

  async function tramo(inicio: number, fin: number): Promise<Lectura[]> {
    const datos = await listarLecturas(contenedor, new Date(inicio), new Date(fin), signal);
    if (datos.length < MAX_LECTURAS_POR_CONSULTA) return datos;
    if (fin - inicio <= TRAMO_MINIMO_MS) {
      incompleto = true;
      return datos;
    }
    const medio = Math.floor((inicio + fin) / 2);
    const [a, b] = await Promise.all([tramo(inicio, medio), tramo(medio, fin)]);
    return [...a, ...b];
  }

  const tramos: [number, number][] = [];
  for (let t = desde.getTime(); t < hasta.getTime(); t += TRAMO_MS) tramos.push([t, Math.min(t + TRAMO_MS, hasta.getTime())]);

  const resultados: Lectura[][] = [];
  for (let i = 0; i < tramos.length; i += CONSULTAS_EN_PARALELO) {
    const grupo = tramos.slice(i, i + CONSULTAS_EN_PARALELO);
    resultados.push(...(await Promise.all(grupo.map(([a, b]) => tramo(a, b)))));
  }

  const porId = new Map<number, Lectura>();
  for (const l of resultados.flat()) porId.set(l.id, l);
  const lecturas = [...porId.values()].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  return { lecturas, incompleto };
}

export interface Intervalo {
  inicio: number;
  promedio: number | null;
  min: number | null;
  max: number | null;
  humedad: number | null;
  cantidad: number;
}

/** Resume las lecturas en intervalos fijos (5 min por defecto). Los intervalos sin datos quedan en null. */
export function agruparPorIntervalo(
  lecturas: Pick<Lectura, 'temperatura' | 'humedad' | 'receivedAt'>[],
  desde: number,
  hasta: number,
  minutos = MINUTOS_POR_INTERVALO,
): Intervalo[] {
  const paso = minutos * 60_000;
  const primero = Math.floor(desde / paso) * paso;
  const total = Math.max(0, Math.ceil((hasta - primero) / paso));
  const acum = Array.from({ length: total }, () => ({ suma: 0, n: 0, min: Infinity, max: -Infinity, hum: 0, nHum: 0 }));

  for (const l of lecturas) {
    if (!esNumero(l.temperatura)) continue;
    const i = Math.floor((new Date(l.receivedAt).getTime() - primero) / paso);
    if (i < 0 || i >= total) continue;
    const a = acum[i];
    a.suma += l.temperatura;
    a.n += 1;
    a.min = Math.min(a.min, l.temperatura);
    a.max = Math.max(a.max, l.temperatura);
    if (esNumero(l.humedad)) {
      a.hum += l.humedad;
      a.nHum += 1;
    }
  }

  return acum.map((a, i) => ({
    inicio: primero + i * paso,
    promedio: a.n ? a.suma / a.n : null,
    min: a.n ? a.min : null,
    max: a.n ? a.max : null,
    humedad: a.nHum ? a.hum / a.nHum : null,
    cantidad: a.n,
  }));
}

export interface ResumenHistorial {
  lecturasValidas: number;
  min: number | null;
  max: number | null;
  promedio: number | null;
  /** % de intervalos con datos que estuvieron completamente dentro del rango. */
  porcentajeEnRango: number | null;
  /** % de intervalos de 5 min que tienen al menos una lectura. */
  cobertura: number;
  intervalosFueraDeRango: number;
  intervalosSinDatos: number;
}

export function resumirHistorial(intervalos: Intervalo[], rango: { min: number; max: number }): ResumenHistorial {
  const conDatos = intervalos.filter((i) => i.cantidad > 0);
  const fuera = conDatos.filter((i) => (i.min as number) < rango.min || (i.max as number) > rango.max).length;
  const lecturas = conDatos.reduce((s, i) => s + i.cantidad, 0);
  const suma = conDatos.reduce((s, i) => s + (i.promedio as number) * i.cantidad, 0);
  return {
    lecturasValidas: lecturas,
    min: conDatos.length ? Math.min(...conDatos.map((i) => i.min as number)) : null,
    max: conDatos.length ? Math.max(...conDatos.map((i) => i.max as number)) : null,
    promedio: lecturas ? suma / lecturas : null,
    porcentajeEnRango: conDatos.length ? ((conDatos.length - fuera) / conDatos.length) * 100 : null,
    cobertura: intervalos.length ? (conDatos.length / intervalos.length) * 100 : 0,
    intervalosFueraDeRango: fuera,
    intervalosSinDatos: intervalos.length - conDatos.length,
  };
}
