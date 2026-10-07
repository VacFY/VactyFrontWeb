import type { Alerta, EstadoAlerta, FiltroAlertas, TipoAlerta } from '../api/tipos';

export const TEXTO_TIPO_ALERTA: Record<TipoAlerta, string> = {
  OUT_OF_RANGE: 'Temperatura fuera de rango',
  RAPID_CHANGE: 'Cambio brusco de temperatura',
  SENSOR_OFFLINE: 'Sensor sin señal',
  INVALID_READING: 'Lecturas inválidas del sensor',
};

export const TEXTO_ESTADO_ALERTA: Record<EstadoAlerta, string> = {
  ACTIVE: 'Activa',
  ACKNOWLEDGED: 'Vista',
  RESOLVED: 'Resuelta',
};

export const TEXTO_FILTRO_ALERTAS: Record<FiltroAlertas, string> = {
  OPEN: 'Abiertas (activas y vistas)',
  ACTIVE: 'Activas',
  ACKNOWLEDGED: 'Vistas',
  RESOLVED: 'Resueltas',
  ALL: 'Todas',
};

export function cumpleFiltro(alerta: Alerta, filtro: FiltroAlertas): boolean {
  if (filtro === 'ALL') return true;
  if (filtro === 'OPEN') return alerta.status !== 'RESOLVED';
  return alerta.status === filtro;
}

/** Qué hacer ante cada alerta, en palabras simples. */
export function guiaAlerta(alerta: Alerta, rangoMin: number): string {
  switch (alerta.type) {
    case 'OUT_OF_RANGE':
      if (alerta.severity === 'CRITICAL' || (alerta.triggerValue != null && alerta.triggerValue < rangoMin))
        return 'Separa los frascos de los paquetes fríos (usa un separador o cartón). No apliques vacunas sensibles a la congelación sin consultar a tu microred.';
      return 'Cierra bien el termo, ponlo a la sombra y cambia los paquetes fríos. Si la temperatura no baja, consulta a tu microred antes de vacunar.';
    case 'RAPID_CHANGE':
      return 'Revisa si el termo quedó abierto, al sol o si acabas de cambiar los paquetes fríos. Observa que la temperatura se estabilice.';
    case 'SENSOR_OFFLINE':
      return 'Revisa que el sensor esté encendido, con batería y con señal. Mientras tanto, controla la temperatura con un termómetro.';
    case 'INVALID_READING':
      return 'El sensor envía datos imposibles. Revisa su conexión o reinícialo, y controla la temperatura con un termómetro.';
  }
}

/** Primero las críticas; luego, la más reciente. */
export function ordenarAlertas(alertas: Alerta[]): Alerta[] {
  return [...alertas].sort(
    (a, b) =>
      Number(b.severity === 'CRITICAL') - Number(a.severity === 'CRITICAL') || b.startedAt.localeCompare(a.startedAt),
  );
}
