// Vacunas de rutina que salen en el termo. Rango por defecto del PAI: +2 a +8 °C.
// Sensibilidad a la congelación según el Manual de Inmunizaciones de la AEP, cap. 6.
export interface VacunaCatalogo {
  nombre: string;
  sensibleCongelacion: boolean;
  min: number;
  max: number;
}

export const CATALOGO_VACUNAS: VacunaCatalogo[] = [
  { nombre: 'Pentavalente', sensibleCongelacion: true, min: 2, max: 8 },
  { nombre: 'Hexavalente', sensibleCongelacion: true, min: 2, max: 8 },
  { nombre: 'Hepatitis B', sensibleCongelacion: true, min: 2, max: 8 },
  { nombre: 'Hepatitis A', sensibleCongelacion: true, min: 2, max: 8 },
  { nombre: 'Neumococo conjugada', sensibleCongelacion: true, min: 2, max: 8 },
  { nombre: 'Polio inactivada', sensibleCongelacion: true, min: 2, max: 8 },
  { nombre: 'Influenza', sensibleCongelacion: true, min: 2, max: 8 },
  { nombre: 'SPR', sensibleCongelacion: false, min: 2, max: 8 },
  { nombre: 'Varicela', sensibleCongelacion: false, min: 2, max: 8 },
  { nombre: 'Polio oral', sensibleCongelacion: false, min: 2, max: 8 },
  { nombre: 'Rotavirus', sensibleCongelacion: false, min: 2, max: 8 },
  { nombre: 'BCG', sensibleCongelacion: false, min: 2, max: 8 },
  { nombre: 'Fiebre amarilla', sensibleCongelacion: false, min: 2, max: 8 },
];

export function buscarEnCatalogo(nombre: string): VacunaCatalogo | undefined {
  const n = nombre.trim().toLocaleLowerCase('es');
  return CATALOGO_VACUNAS.find((v) => v.nombre.toLocaleLowerCase('es') === n);
}
