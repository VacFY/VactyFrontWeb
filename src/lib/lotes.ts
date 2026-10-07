import type { LoteApi } from '../api/tipos';
import { diasHasta, fechaLocal, hoyISO } from './format';

export type EtapaVvm = 1 | 2 | 3 | 4;

export interface InfoEtapaVvm {
  etapa: EtapaVvm;
  titulo: string;
  usable: boolean;
  indicacion: string;
  /** Tono del cuadrado interior en la ilustración (el círculo siempre es el más oscuro de referencia). */
  tonoCuadrado: string;
}

// Etapas del VVM según OMS/PATH: se usa mientras el cuadrado sea más claro que el círculo.
export const ETAPAS_VVM: InfoEtapaVvm[] = [
  {
    etapa: 1,
    titulo: 'Cuadrado mucho más claro que el círculo',
    usable: true,
    indicacion: 'Se puede usar.',
    tonoCuadrado: '#f6f1ea',
  },
  {
    etapa: 2,
    titulo: 'Cuadrado más claro, pero ya oscureciéndose',
    usable: true,
    indicacion: 'Se puede usar. Úsalo antes que los frascos en etapa 1.',
    tonoCuadrado: '#b9a796',
  },
  {
    etapa: 3,
    titulo: 'Cuadrado del mismo color que el círculo',
    usable: false,
    indicacion: 'No usar: llegó al punto de descarte.',
    tonoCuadrado: '#5a4636',
  },
  {
    etapa: 4,
    titulo: 'Cuadrado más oscuro que el círculo',
    usable: false,
    indicacion: 'No usar: pasó el punto de descarte.',
    tonoCuadrado: '#24170f',
  },
];

export const TONO_CIRCULO_VVM = '#5a4636';

export function infoVvm(etapa: EtapaVvm): InfoEtapaVvm {
  return ETAPAS_VVM[etapa - 1];
}

export interface Verificacion {
  fecha: string;
  etapaVvm: EtapaVvm;
  apto: boolean;
  motivos: string[];
}

/**
 * Lo que el backend no guarda: VVM, foto y verificaciones antes de vacunar.
 * Vive en este dispositivo, indexado por el id del lote del backend.
 */
export interface DatosLocalesLote {
  etapaVvm: EtapaVvm | null;
  fotoVvm: string | null;
  verificaciones: Verificacion[];
}

export const SIN_DATOS_LOCALES: DatosLocalesLote = { etapaVvm: null, fotoVvm: null, verificaciones: [] };

export type EstadoLote = 'vencido' | 'no_apto' | 'por_vencer' | 'vigente';

export const TEXTO_ESTADO_LOTE: Record<EstadoLote, string> = {
  vencido: 'Vencido',
  no_apto: 'No apto',
  por_vencer: 'Por vencer',
  vigente: 'Vigente',
};

export function ultimaVerificacion(local: DatosLocalesLote): Verificacion | undefined {
  return local.verificaciones[local.verificaciones.length - 1];
}

/** Etapa del VVM más reciente: la de la última verificación o, si no hay, la del registro. */
export function etapaActual(local: DatosLocalesLote): EtapaVvm | null {
  return ultimaVerificacion(local)?.etapaVvm ?? local.etapaVvm;
}

export function vencido(lote: Pick<LoteApi, 'status' | 'expiryDate'>, hoy: string = hoyISO()): boolean {
  return lote.status === 'EXPIRED' || diasHasta(lote.expiryDate, hoy) < 0;
}

export function estadoLote(
  lote: Pick<LoteApi, 'status' | 'expiryDate'>,
  local: DatosLocalesLote,
  umbralDias: number,
  hoy: string = hoyISO(),
): EstadoLote {
  if (vencido(lote, hoy)) return 'vencido';
  const etapa = etapaActual(local);
  if (etapa != null && !infoVvm(etapa).usable) return 'no_apto';
  if (diasHasta(lote.expiryDate, hoy) <= umbralDias) return 'por_vencer';
  return 'vigente';
}

/** FEFO: primero lo que vence antes. */
export function ordenarFefo<T extends Pick<LoteApi, 'expiryDate' | 'lotNumber'>>(lotes: T[]): T[] {
  return [...lotes].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate) || a.lotNumber.localeCompare(b.lotNumber));
}

/** Por cada vacuna, el lote apto que se debe usar primero. */
export function lotesUsarPrimero(
  lotes: LoteApi[],
  locales: Record<number, DatosLocalesLote>,
  hoy: string = hoyISO(),
): Set<number> {
  const ids = new Set<number>();
  const vistas = new Set<number>();
  for (const lote of ordenarFefo(lotes)) {
    if (vistas.has(lote.vaccine.id)) continue;
    if (lote.status !== 'ACTIVE' || vencido(lote, hoy)) continue;
    const etapa = etapaActual(locales[lote.id] ?? SIN_DATOS_LOCALES);
    if (etapa != null && !infoVvm(etapa).usable) continue;
    vistas.add(lote.vaccine.id);
    ids.add(lote.id);
  }
  return ids;
}

export function verificarLote(lote: Pick<LoteApi, 'status' | 'expiryDate'>, etapaVvm: EtapaVvm, hoy: string = hoyISO()): Verificacion {
  const motivos: string[] = [];
  if (vencido(lote, hoy)) motivos.push('El lote está vencido.');
  if (!infoVvm(etapaVvm).usable) motivos.push(`VVM en etapa ${etapaVvm}: ${infoVvm(etapaVvm).indicacion}`);
  return { fecha: new Date().toISOString(), etapaVvm, apto: motivos.length === 0, motivos };
}

export interface DatosLote {
  vacunaId: string;
  numero: string;
  vencimiento: string;
  frascos: string;
  dosis: string;
  etapaVvm: EtapaVvm | null;
}

export type ErroresLote = Partial<Record<keyof DatosLote, string>>;

export function normalizarNumeroLote(numero: string): string {
  return numero.trim().toUpperCase();
}

/** Validación previa al envío; el backend vuelve a validar (rango común del termo, lote repetido, GTIN). */
export function validarLote(datos: DatosLote, hoy: string = hoyISO()): ErroresLote {
  const e: ErroresLote = {};

  if (!datos.vacunaId) e.vacunaId = 'Elige la vacuna del lote.';

  const numero = normalizarNumeroLote(datos.numero);
  if (!numero) e.numero = 'Ingresa el número de lote impreso en la etiqueta.';
  else if (numero.length > 20) e.numero = 'El número de lote admite máximo 20 caracteres.';

  if (!datos.vencimiento) e.vencimiento = 'Ingresa la fecha de vencimiento.';
  else if (Number.isNaN(fechaLocal(datos.vencimiento).getTime())) e.vencimiento = 'La fecha no es válida.';
  else if (diasHasta(datos.vencimiento, hoy) < 0) e.vencimiento = 'El lote está vencido: no debe salir en el termo.';
  else if (diasHasta(datos.vencimiento, hoy) > 365 * 10) e.vencimiento = 'Revisa la fecha: está a más de 10 años.';

  const frascos = datos.frascos.trim();
  if (!frascos) e.frascos = 'Ingresa la cantidad de frascos.';
  else if (!/^\d+$/.test(frascos) || Number(frascos) < 1 || Number(frascos) > 500)
    e.frascos = 'Debe ser un número entero entre 1 y 500.';

  const dosis = datos.dosis.trim();
  if (dosis && (!/^\d+$/.test(dosis) || Number(dosis) < 1 || Number(dosis) > 10000))
    e.dosis = 'Debe ser un número entero mayor que 0.';

  if (datos.etapaVvm == null) e.etapaVvm = 'Indica cómo se ve el VVM del frasco.';
  else if (!infoVvm(datos.etapaVvm).usable)
    e.etapaVvm = 'Con el VVM en este estado el lote no es apto: no debe salir en el termo.';

  return e;
}
