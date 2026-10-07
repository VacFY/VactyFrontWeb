export const SIGLAS = {
  DNI: 'Documento Nacional de Identidad.',
  VVM: 'Monitor del vial de la vacuna (en inglés, Vaccine Vial Monitor): etiqueta del frasco que se oscurece con el calor acumulado. No detecta congelación.',
  FEFO: 'En inglés, First Expired, First Out: "lo que vence primero, sale primero".',
  SPR: 'Vacuna contra sarampión, paperas y rubéola.',
  PAI: 'Programa Ampliado de Inmunizaciones.',
  BCG: 'Vacuna contra la tuberculosis (bacilo de Calmette-Guérin).',
} as const;

export type Sigla = keyof typeof SIGLAS;

/** Siglas conocidas que aparecen en un texto (p. ej. mensajes de alerta del servidor). */
export function siglasEnTexto(...textos: (string | null | undefined)[]): Sigla[] {
  const unido = textos.filter(Boolean).join(' ');
  return (Object.keys(SIGLAS) as Sigla[]).filter((s) => new RegExp(`\\b${s}\\b`).test(unido));
}
