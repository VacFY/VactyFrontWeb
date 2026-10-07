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

export interface Lote {
  id: string;
  vacuna: string;
  numero: string;
  /** "AAAA-MM-DD". */
  vencimiento: string;
  frascos: number;
  etapaVvm: EtapaVvm;
  fotoVvm: string | null;
  registradoEn: string;
  verificaciones: Verificacion[];
}

export type EstadoLote = 'vencido' | 'no_apto' | 'por_vencer' | 'vigente';

export const TEXTO_ESTADO_LOTE: Record<EstadoLote, string> = {
  vencido: 'Vencido',
  no_apto: 'No apto',
  por_vencer: 'Por vencer',
  vigente: 'Vigente',
};

export function ultimaVerificacion(lote: Lote): Verificacion | undefined {
  return lote.verificaciones[lote.verificaciones.length - 1];
}

/** Etapa del VVM más reciente: la de la última verificación o, si no hay, la del registro. */
export function etapaActual(lote: Lote): EtapaVvm {
  return ultimaVerificacion(lote)?.etapaVvm ?? lote.etapaVvm;
}

export function estadoLote(lote: Lote, umbralDias: number, hoy: string = hoyISO()): EstadoLote {
  const dias = diasHasta(lote.vencimiento, hoy);
  if (dias < 0) return 'vencido';
  if (!infoVvm(etapaActual(lote)).usable) return 'no_apto';
  if (dias <= umbralDias) return 'por_vencer';
  return 'vigente';
}

/** FEFO: primero lo que vence antes; a igual fecha, primero el VVM más avanzado. */
export function ordenarFefo(lotes: Lote[]): Lote[] {
  return [...lotes].sort(
    (a, b) => a.vencimiento.localeCompare(b.vencimiento) || etapaActual(b) - etapaActual(a) || a.numero.localeCompare(b.numero),
  );
}

/** Por cada vacuna, el lote apto que se debe usar primero. */
export function lotesUsarPrimero(lotes: Lote[], hoy: string = hoyISO()): Set<string> {
  const ids = new Set<string>();
  const vistas = new Set<string>();
  for (const lote of ordenarFefo(lotes)) {
    if (vistas.has(lote.vacuna)) continue;
    if (diasHasta(lote.vencimiento, hoy) < 0 || !infoVvm(etapaActual(lote)).usable) continue;
    vistas.add(lote.vacuna);
    ids.add(lote.id);
  }
  return ids;
}

export function verificarLote(lote: Lote, etapaVvm: EtapaVvm, hoy: string = hoyISO()): Verificacion {
  const motivos: string[] = [];
  if (diasHasta(lote.vencimiento, hoy) < 0) motivos.push('El lote está vencido.');
  if (!infoVvm(etapaVvm).usable) motivos.push(`VVM en etapa ${etapaVvm}: ${infoVvm(etapaVvm).indicacion}`);
  return { fecha: new Date().toISOString(), etapaVvm, apto: motivos.length === 0, motivos };
}

export interface DatosLote {
  vacuna: string;
  numero: string;
  vencimiento: string;
  frascos: string;
  etapaVvm: EtapaVvm | null;
}

export type ErroresLote = Partial<Record<keyof DatosLote, string>>;

export function normalizarNumeroLote(numero: string): string {
  return numero.trim().toUpperCase();
}

export function validarLote(
  datos: DatosLote,
  contexto: { vacunasTermo: string[]; lotes: Lote[]; hoy?: string },
): ErroresLote {
  const hoy = contexto.hoy ?? hoyISO();
  const e: ErroresLote = {};

  if (!datos.vacuna) e.vacuna = 'Elige la vacuna del lote.';
  else if (!contexto.vacunasTermo.includes(datos.vacuna))
    e.vacuna = 'Esa vacuna no está registrada en tu termo. Agrégala primero en «Mi termo».';

  const numero = normalizarNumeroLote(datos.numero);
  if (!numero) e.numero = 'Ingresa el número de lote impreso en la etiqueta.';
  else if (!/^[A-Z0-9-]{3,20}$/.test(numero)) e.numero = 'Usa de 3 a 20 letras, números o guiones.';
  else if (contexto.lotes.some((l) => l.vacuna === datos.vacuna && l.numero === numero))
    e.numero = 'Ese lote de esta vacuna ya está registrado.';

  if (!datos.vencimiento) e.vencimiento = 'Ingresa la fecha de vencimiento.';
  else if (Number.isNaN(fechaLocal(datos.vencimiento).getTime())) e.vencimiento = 'La fecha no es válida.';
  else if (diasHasta(datos.vencimiento, hoy) < 0)
    e.vencimiento = 'El lote está vencido: no debe salir en el termo.';
  else if (diasHasta(datos.vencimiento, hoy) > 365 * 10) e.vencimiento = 'Revisa la fecha: está a más de 10 años.';

  const frascos = datos.frascos.trim();
  if (!frascos) e.frascos = 'Ingresa la cantidad de frascos.';
  else if (!/^\d+$/.test(frascos) || Number(frascos) < 1 || Number(frascos) > 500)
    e.frascos = 'Debe ser un número entero entre 1 y 500.';

  if (datos.etapaVvm == null) e.etapaVvm = 'Indica cómo se ve el VVM del frasco.';
  else if (!infoVvm(datos.etapaVvm).usable)
    e.etapaVvm = 'Con el VVM en este estado el lote no es apto: no debe salir en el termo.';

  return e;
}
